import { existsSync, mkdirSync, watch } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import {
  baseNameOf,
  folderOf,
  joinSavedPath,
  toFolderName,
} from "@lunarscribe/utils/saved-paths";
import { Debouncer } from "@tanstack/pacer/debouncer";
import { app, BrowserWindow, ipcMain } from "electron";

import {
  getFileExtension,
  INVALID_FILE_TITLE_CHARACTERS,
  stemOf,
} from "../lib/editor-files";
import { registerFileSearch } from "./file-search";
import { registerFileWatcher } from "./file-watcher";
import { listSavedEntries, resolveSavedPath } from "./saved-path";
import { registerSync } from "./sync/sync-service";

/** Saves buffers as `<folder>/<title><extension>` in Documents/lunarscribe and tells windows when it changes. */
export function registerDocumentsFolder() {
  const queueFileOperation = createOperationQueue();
  const folder = join(app.getPath("documents"), "lunarscribe");
  const pathOf = (name: string) => resolveSavedPath(folder, name);

  /** `<stem><extension>` in `parent`, or `<stem>_1<extension>`, ... when another file has it. */
  const availableName = (
    parent: string,
    stem: string,
    extension: string,
    previousName: string | null,
  ) => {
    let name = joinSavedPath(parent, `${stem}${extension}`);

    // Never overwrite another file: take `<stem>_1`, `<stem>_2`, ... instead.
    for (
      let suffix = 1;
      name !== previousName && existsSync(pathOf(name));
      suffix += 1
    ) {
      name = joinSavedPath(parent, `${stem}_${suffix}${extension}`);
    }

    return name;
  };

  /** A folder that does not exist yet, so creating or renaming never merges two folders. */
  const assertNewFolder = (path: string) => {
    if (existsSync(pathOf(path))) {
      throw new Error(`A file or folder named “${baseNameOf(path)}” exists.`);
    }
  };

  mkdirSync(folder, { recursive: true });
  registerFileSearch(folder);
  registerFileWatcher(folder);
  registerSync(folder, queueFileOperation);

  ipcMain.handle("files:list", () => listSavedEntries(folder));
  ipcMain.handle("files:path", (_event, name: string) => pathOf(name));
  ipcMain.handle("files:read", (_event, name: string) =>
    queueFileOperation(folder, () => readFile(pathOf(name), "utf8")),
  );
  ipcMain.handle(
    "files:save",
    async (
      _event,
      previousName: string | null,
      parent: string,
      title: string,
      extension: string,
      content: string,
      expectedContent: string | null,
    ) => {
      return queueFileOperation(folder, async () => {
        if (previousName && expectedContent !== null) {
          let current: string;

          try {
            current = await readFile(pathOf(previousName), "utf8");
          } catch {
            throw new Error(
              "The saved file was removed or cannot be read. Your buffer is safe; copy your writing before reopening the saved file.",
            );
          }

          if (current !== expectedContent) {
            throw new Error(
              "The saved file changed since this buffer was loaded. Your edits were preserved. Copy your writing before reopening the saved file to resolve the conflict.",
            );
          }
        }

        // Slashes would make the written file differ from the name the buffer records.
        const stem =
          title.trim().replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_") ||
          "untitled";

        // A saved file stays in its folder; a new one goes where it was created.
        const name = availableName(
          previousName === null ? parent : folderOf(previousName),
          stem,
          extension,
          previousName,
        );

        await mkdir(dirname(pathOf(name)), { recursive: true });
        await writeFile(pathOf(name), content);

        if (previousName && previousName !== name) {
          await rm(pathOf(previousName), { force: true });
        }

        return name;
      });
    },
  );
  ipcMain.handle("files:move", (_event, name: string, parent: string) =>
    queueFileOperation(folder, async () => {
      if (folderOf(name) === parent) {
        return name;
      }

      const moved = availableName(
        parent,
        stemOf(name),
        getFileExtension(name) ?? "",
        null,
      );

      await mkdir(dirname(pathOf(moved)), { recursive: true });
      await rename(pathOf(name), pathOf(moved));

      return moved;
    }),
  );
  ipcMain.handle("files:delete", (_event, name: string) =>
    queueFileOperation(folder, () => rm(pathOf(name), { force: true })),
  );
  ipcMain.handle("folders:create", (_event, parent: string, input: string) =>
    queueFileOperation(folder, async () => {
      const path = joinSavedPath(parent, toFolderName(input));

      assertNewFolder(path);
      await mkdir(pathOf(path), { recursive: true });

      return path;
    }),
  );
  ipcMain.handle("folders:rename", (_event, path: string, input: string) =>
    queueFileOperation(folder, async () => {
      const renamed = joinSavedPath(folderOf(path), toFolderName(input));

      if (renamed === path) {
        return path;
      }

      // Case-only renames on macOS see the old folder as already existing.
      if (renamed.toLowerCase() !== path.toLowerCase()) {
        assertNewFolder(renamed);
      }

      await rename(pathOf(path), pathOf(renamed));

      return renamed;
    }),
  );
  ipcMain.handle("folders:delete", (_event, path: string) =>
    queueFileOperation(folder, () =>
      rm(pathOf(path), { recursive: true, force: true }),
    ),
  );

  const notify = new Debouncer(
    async () => {
      const entries = await listSavedEntries(folder);

      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("files:changed", entries);
      }
    },
    { wait: 100 },
  );

  // Recursive, so edits inside folders refresh the sidebar too.
  watch(folder, { recursive: true }, () => notify.maybeExecute());
}
