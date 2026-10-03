import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { app, BrowserWindow, dialog, ipcMain } from "electron";

/** Print an isolated, static editor snapshot; Chromium retains selectable text and links. */
export function registerPdfExport() {
  ipcMain.handle(
    "files:export-pdf",
    async (event, title: string, html: string) => {
      const owner = BrowserWindow.fromWebContents(event.sender);

      if (!owner) {
        throw new Error("The editor window is no longer open.");
      }

      const selection = await dialog.showSaveDialog(owner, {
        title: "Export as PDF",
        defaultPath: join(
          app.getPath("documents"),
          `${basename(title) || "untitled"}.pdf`,
        ),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        properties: ["showOverwriteConfirmation", "createDirectory"],
      });

      if (selection.canceled || !selection.filePath) {
        return null;
      }

      const filePath = selection.filePath;

      const snapshotFolder = await mkdtemp(join(tmpdir(), "lunarscribe-pdf-"));

      const printWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 1123,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });

      printWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      printWindow.webContents.on("will-navigate", (navigation) =>
        navigation.preventDefault(),
      );

      try {
        // A local HTML file lets packaged styles and offline fonts load with web security enabled.
        const csp =
          "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'none'; style-src 'unsafe-inline' file: http: https:; font-src file: data: http: https:; img-src file: data: http: https:; base-uri file: http: https:\">";

        const snapshotPath = join(snapshotFolder, "snapshot.html");

        await writeFile(snapshotPath, html.replace("<head>", `<head>${csp}`));
        await printWindow.loadFile(snapshotPath);
        await printWindow.webContents.executeJavaScript(`(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
        const probe = document.createElement("div");
        probe.style.height = "var(--pdf-page-height)";
        document.body.append(probe);
        const pageHeight = probe.getBoundingClientRect().height;
        probe.remove();
        const root = document.getElementById("pdf-markdown");
        if (!root) throw new Error("Missing markdown for PDF export.");
        // Scale exceptionally wide tables and equations rather than cropping them.
        for (const element of root.querySelectorAll("table, .katex-display")) {
          const availableWidth = element.parentElement.clientWidth;
          if (element.scrollWidth > availableWidth) {
            element.style.zoom = availableWidth / element.scrollWidth;
          }
        }
        // Only blocks taller than a whole page may fragment; their smaller children stay intact.
        for (const block of root.querySelectorAll(":scope > *, p, li, tr, blockquote, ul, ol, table, code.block, .editor-math-block")) {
          if (block.getBoundingClientRect().height > pageHeight) {
            block.setAttribute("data-pdf-splittable", "");
          }
        }
      })()`);

        const pdf = await printWindow.webContents.printToPDF({
          pageSize: "A4",
          preferCSSPageSize: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          printBackground: true,
          displayHeaderFooter: false,
          generateTaggedPDF: true,
        });

        await writeFile(filePath, pdf);

        return filePath;
      } finally {
        printWindow.destroy();
        await rm(snapshotFolder, { recursive: true, force: true });
      }
    },
  );
}
