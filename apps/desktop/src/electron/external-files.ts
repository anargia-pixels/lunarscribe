import { constants } from "node:fs";
import {
  copyFile,
  link,
  lstat,
  readFile,
  readlink,
  realpath,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import { app, BrowserWindow, ipcMain } from "electron";

import { INVALID_FILE_TITLE_CHARACTERS, isTextFile } from "../lib/editor-files";
import type { ExternalFile, OpenedExternalFile } from "../lib/editor-files";

const pendingPaths = new Set<string>();

const readyWindows = new Set<number>();

const openedPaths = new Set<string>();

const queueFileWrite = createOperationQueue();

const UNSUPPORTED_LINK_CODES = [
  "EXDEV",
  "ENOTSUP",
  "EOPNOTSUPP",
  "EPERM",
  "ENOSYS",
] as const;

/** Reads local text files; canonical paths deduplicate aliases while source paths survive reopening. */
async function readTextFile(path: string): Promise<OpenedExternalFile> {
  if (!isAbsolute(path) || !isTextFile(path)) {
    throw new Error("Choose a local .md, .markdown, or .txt file.");
  }

  const canonicalPath = await realpath(path);

  if (!(await stat(canonicalPath)).isFile()) {
    throw new Error("The text path must be a file.");
  }

  const markdown = await readFile(canonicalPath, "utf8");

  openedPaths.add(canonicalPath);

  return {
    path: canonicalPath,
    sourcePath: path,
    name: basename(path),
    markdown,
  };
}

/** Serializes writes to each original file so a slower save cannot overwrite a newer one. */
async function saveTextFile(path: string, markdown: string) {
  if (!openedPaths.has(path)) {
    throw new Error("Open the text file before saving it.");
  }

  const write = async () => {
    // Do not recreate a deleted file or follow a replacement symlink elsewhere.
    if ((await realpath(path)) !== path || !(await stat(path)).isFile()) {
      throw new Error("The original text file is no longer available.");
    }

    await writeFile(path, markdown);
  };

  await queueFileWrite(path, write);
}

/** Only filesystem limitations justify copying instead of linking. Other failures propagate. */
function isUnsupportedLinkError(
  cause: unknown,
): cause is NodeJS.ErrnoException {
  return (
    cause instanceof Error &&
    "code" in cause &&
    UNSUPPORTED_LINK_CODES.some((code) => code === cause.code)
  );
}

/** Link preserves the inode; the copy fallback also preserves symlinks and refuses overwrites. */
async function createRenameDestination(
  sourcePath: string,
  destinationPath: string,
) {
  try {
    await link(sourcePath, destinationPath);

    return;
  } catch (cause) {
    if (!isUnsupportedLinkError(cause)) {
      throw cause;
    }
  }

  const source = await lstat(sourcePath);

  if (source.isSymbolicLink()) {
    // fs.cp can unlink an existing symlink even with force:false. Creation must stay exclusive.
    await symlink(await readlink(sourcePath), destinationPath);

    return;
  }

  await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
}

/** Renames the source entry in its own folder, preserving symlinks and refusing to overwrite. */
async function renameTextFile(
  path: string,
  sourcePath: string,
  title: string,
): Promise<ExternalFile> {
  if (
    !openedPaths.has(path) ||
    !isAbsolute(sourcePath) ||
    !isTextFile(sourcePath)
  ) {
    throw new Error("Open the text file before renaming it.");
  }

  const stem = title.trim();

  if (!stem || stem.match(INVALID_FILE_TITLE_CHARACTERS)) {
    throw new Error("Enter a name without slashes.");
  }

  return queueFileWrite(path, async () => {
    if ((await realpath(sourcePath)) !== path || !(await stat(path)).isFile()) {
      throw new Error("The original text file is no longer available.");
    }

    const originalName = basename(sourcePath);
    const name = `${stem}${originalName.slice(originalName.lastIndexOf("."))}`;
    const renamedSourcePath = join(dirname(sourcePath), name);

    if (renamedSourcePath === sourcePath) {
      // A no-op rename leaves the canonical path authorized for later saves.
      return { path, sourcePath, name };
    }

    await createRenameDestination(sourcePath, renamedSourcePath);

    let renamedPath: string;

    try {
      renamedPath = await realpath(renamedSourcePath);
      await unlink(sourcePath);
    } catch (error) {
      await unlink(renamedSourcePath);

      throw error;
    }

    openedPaths.delete(path);
    openedPaths.add(renamedPath);

    return { path: renamedPath, sourcePath: renamedSourcePath, name };
  });
}

/** Delivers queued paths only after the renderer has subscribed, including on cold launch. */
function deliverPendingFiles() {
  if (!app.isReady()) {
    return;
  }

  const window = BrowserWindow.getAllWindows().find((candidate) =>
    readyWindows.has(candidate.webContents.id),
  );

  if (!window || pendingPaths.size === 0) {
    return;
  }

  window.webContents.send("external-files:opened", [...pendingPaths]);
  pendingPaths.clear();
}

/** Accepts file paths, file URLs, or lunarscribe://open?path=<absolute path> links. */
export function queueExternalFiles(
  arguments_: string[],
  workingDirectory: string,
) {
  for (const argument of arguments_) {
    if (argument.startsWith("-")) {
      continue;
    }

    try {
      let path = argument;

      if (argument.startsWith("file:")) {
        path = fileURLToPath(argument);
      }

      if (argument.startsWith("lunarscribe:")) {
        const url = new URL(argument);

        if (url.hostname !== "open") {
          continue;
        }

        path = url.searchParams.get("path") ?? "";

        if (!isAbsolute(path)) {
          continue;
        }
      }

      if (isTextFile(path)) {
        pendingPaths.add(resolve(workingDirectory, path));
      }
    } catch {
      // Malformed file URLs and deep links are not file-open requests.
    }
  }

  deliverPendingFiles();
}

/** Registers the restricted read bridge and the renderer-ready handshake. */
export function registerExternalFiles() {
  ipcMain.handle("external-files:read", (_event, path: string) =>
    readTextFile(path),
  );
  ipcMain.handle(
    "external-files:save",
    (_event, path: string, markdown: string) => saveTextFile(path, markdown),
  );
  ipcMain.handle(
    "external-files:rename",
    (_event, path: string, sourcePath: string, title: string) =>
      renameTextFile(path, sourcePath, title),
  );
  ipcMain.on("external-files:ready", (event) => {
    readyWindows.add(event.sender.id);
    deliverPendingFiles();
  });
  ipcMain.on("external-files:paused", (event) => {
    readyWindows.delete(event.sender.id);
  });

  app.on("browser-window-created", (_event, window) => {
    const id = window.webContents.id;

    window.webContents.on("did-start-loading", () => readyWindows.delete(id));
    window.on("closed", () => readyWindows.delete(id));
  });
}
