import { existsSync, mkdirSync, watch } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { Debouncer } from "@tanstack/pacer/debouncer";
import { app, BrowserWindow, ipcMain } from "electron";

import {
  getFileExtension,
  INVALID_FILE_TITLE_CHARACTERS,
} from "../lib/editor-files";
import { createOperationQueue } from "../lib/operation-queue";
import { registerFileSearch } from "./file-search";
import { registerSync } from "./sync/sync-service";

/** Saves buffers as `<title><extension>` in Documents/lunarscribe and tells windows when the folder changes. */
export function registerDocumentsFolder() {
  const queueFileOperation = createOperationQueue();
  const folder = join(app.getPath("documents"), "lunarscribe");
  // basename keeps renderer-supplied names inside the folder.
  const pathOf = (name: string) => join(folder, basename(name));

  const listFiles = async () =>
    (await readdir(folder)).filter((name) => getFileExtension(name) !== null);

  mkdirSync(folder, { recursive: true });
  registerFileSearch(folder);
  registerSync(folder, queueFileOperation);

  ipcMain.handle("files:list", listFiles);
  ipcMain.handle("files:path", (_event, name: string) => pathOf(name));
  ipcMain.handle("files:read", (_event, name: string) =>
    queueFileOperation(folder, () => readFile(pathOf(name), "utf8")),
  );
  ipcMain.handle(
    "files:save",
    async (
      _event,
      previousName: string | null,
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

        let name = `${stem}${extension}`;

        // Never overwrite another file: take `<stem>_1`, `<stem>_2`, ... instead.
        for (
          let suffix = 1;
          name !== previousName && existsSync(pathOf(name));
          suffix += 1
        ) {
          name = `${stem}_${suffix}${extension}`;
        }

        await writeFile(pathOf(name), content);

        if (previousName && previousName !== name) {
          await rm(pathOf(previousName), { force: true });
        }

        return name;
      });
    },
  );
  ipcMain.handle("files:delete", (_event, name: string) =>
    queueFileOperation(folder, () => rm(pathOf(name), { force: true })),
  );

  const notify = new Debouncer(
    async () => {
      const files = await listFiles();

      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("files:changed", files);
      }
    },
    { wait: 100 },
  );

  watch(folder, () => notify.maybeExecute());
}
