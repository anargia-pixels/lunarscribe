import { unwatchFile, watchFile } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { BrowserWindow, ipcMain } from "electron";

import type { WatchedFile, WatchedFileChange } from "../lib/editor-files";
import { isOpenedPath } from "./external-files";

/**
 * Sends an open buffer's markdown to the renderer when another program, such
 * as an agent, writes its file. Polling by path also sees saves that replace
 * the file.
 */
export function registerFileWatcher(folder: string) {
  let watched = new Map<string, WatchedFile>();

  const sendChange = async (path: string) => {
    const file = watched.get(path);
    // Deleted, or caught between a replacing save's unlink and rename.
    const content = await readFile(path, "utf8").catch(() => null);

    if (!file || content === null) {
      return;
    }

    const change: WatchedFileChange = { ...file, content };

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("file-watcher:changed", change);
    }
  };

  ipcMain.on("file-watcher:watch", (_event, files: WatchedFile[]) => {
    const next = new Map<string, WatchedFile>();

    for (const file of files) {
      if (file.kind === "saved") {
        // basename keeps renderer-supplied names inside the folder.
        next.set(join(folder, basename(file.name)), file);
      } else if (isOpenedPath(file.path)) {
        next.set(file.path, file);
      }
    }

    for (const path of watched.keys()) {
      if (!next.has(path)) {
        unwatchFile(path);
      }
    }

    for (const path of next.keys()) {
      if (!watched.has(path)) {
        watchFile(path, { interval: 500 }, (current, previous) => {
          if (current.mtimeMs !== previous.mtimeMs) {
            void sendChange(path);
          }
        });
      }
    }

    watched = next;
  });
}
