import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, ipcMain } from "electron";

import { isTextFile } from "../lib/editor-files";
import type { OpenedExternalFile } from "../lib/editor-files";

const pendingPaths = new Set<string>();

const readyWindows = new Set<number>();

const openedPaths = new Set<string>();

const pendingSaves = new Map<string, Promise<void>>();

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

  // A failed earlier save is reported to its caller; the next save can still retry.
  const previousSave = pendingSaves.get(path) ?? Promise.resolve();

  const pendingSave = previousSave.then(write, write);

  pendingSaves.set(path, pendingSave);

  try {
    await pendingSave;
  } finally {
    if (pendingSaves.get(path) === pendingSave) {
      pendingSaves.delete(path);
    }
  }
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
