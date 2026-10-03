import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { app, BrowserWindow, dialog, ipcMain } from "electron";

/** Save a real DOCX package using the same native save flow as PDF export. */
export function registerDocxExport() {
  ipcMain.handle(
    "files:export-docx",
    async (event, title: string, bytes: Uint8Array) => {
      const owner = BrowserWindow.fromWebContents(event.sender);

      if (!owner) {
        throw new Error("The editor window is no longer open.");
      }

      const selection = await dialog.showSaveDialog(owner, {
        title: "Export as DOCX",
        defaultPath: join(
          app.getPath("documents"),
          `${basename(title) || "untitled"}.docx`,
        ),
        filters: [{ name: "Word document", extensions: ["docx"] }],
        properties: ["showOverwriteConfirmation", "createDirectory"],
      });

      if (selection.canceled || !selection.filePath) {
        return null;
      }

      await writeFile(selection.filePath, bytes);

      return selection.filePath;
    },
  );
}
