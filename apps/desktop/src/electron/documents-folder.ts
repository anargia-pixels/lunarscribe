import { existsSync, mkdirSync, watch } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { Debouncer } from "@tanstack/pacer/debouncer";
import { app, BrowserWindow, ipcMain } from "electron";

/** Saves buffers as `<title>.md` in Documents/lunarscribe and tells windows when the folder changes. */
export function registerDocumentsFolder() {
  const folder = join(app.getPath("documents"), "lunarscribe");
  // basename keeps renderer-supplied names inside the folder.
  const pathOf = (name: string) => join(folder, basename(name));

  const listFiles = async () =>
    (await readdir(folder)).filter((name) => name.endsWith(".md"));

  mkdirSync(folder, { recursive: true });

  ipcMain.handle("files:list", listFiles);
  ipcMain.handle("files:read", (_event, name: string) =>
    readFile(pathOf(name), "utf8"),
  );
  ipcMain.handle(
    "files:save",
    async (
      _event,
      previousName: string | null,
      title: string,
      markdown: string,
    ) => {
      // Slashes would make the written file differ from the name the buffer records.
      const stem = title.trim().replaceAll(/[/\\]/gu, "_") || "untitled";
      let name = `${stem}.md`;

      // Never overwrite another file: take `<stem>_1.md`, `<stem>_2.md`, ... instead.
      for (
        let suffix = 1;
        name !== previousName && existsSync(pathOf(name));
        suffix += 1
      ) {
        name = `${stem}_${suffix}.md`;
      }

      await writeFile(pathOf(name), markdown);

      if (previousName && previousName !== name) {
        await rm(pathOf(previousName), { force: true });
      }

      return name;
    },
  );
  ipcMain.handle("files:delete", (_event, name: string) =>
    rm(pathOf(name), { force: true }),
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
