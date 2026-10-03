import { join } from "node:path";

import { app, BrowserWindow, shell } from "electron";

import appIcon from "../../../../assets/icons/512x512.png?asset";
import { registerDocumentsFolder } from "./documents-folder";
import { registerDocxExport } from "./docx-export";
import { queueExternalFiles, registerExternalFiles } from "./external-files";
import { registerPdfExport } from "./pdf-export";

const hasInstanceLock = app.requestSingleInstanceLock();

if (!hasInstanceLock) {
  app.quit();
}

// macOS can deliver these requests before app.whenReady resolves.
app.on("open-file", (event, path) => {
  event.preventDefault();
  queueExternalFiles([path], process.cwd());
  showEditor();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  queueExternalFiles([url], process.cwd());
  showEditor();
});

app.on("second-instance", (_event, arguments_, workingDirectory) => {
  queueExternalFiles(arguments_.slice(1), workingDirectory);
  showEditor();
});

/** Reuses the editor window for file associations and deep links. */
function showEditor() {
  if (!app.isReady()) {
    return;
  }

  const window = BrowserWindow.getAllWindows()[0];

  if (!window) {
    createWindow();

    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

// Memory trims. A text editor needs no GPU, so compositing runs in software.
app.disableHardwareAcceleration();

// Runs that software compositor inside the main process instead of a GPU process.
app.commandLine.appendSwitch("in-process-gpu");

// Runs the network service inside the main process instead of a utility process.
app.commandLine.appendSwitch("enable-features", "NetworkServiceInProcess2");

/** Opens the editor window and loads the renderer from Vite in dev or disk in production. */
function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 420,
    show: false,
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.cjs"),
      sandbox: true,
    },
  });

  window.on("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);

    return { action: "deny" };
  });

  const devServerUrl = process.env["ELECTRON_RENDERER_URL"];

  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl);

    return;
  }

  void window.loadFile(join(__dirname, "../renderer/index.html"));
}

void app.whenReady().then(() => {
  if (!hasInstanceLock) {
    return;
  }

  if (!app.isPackaged) {
    app.dock?.setIcon(appIcon);
  }

  registerDocumentsFolder();
  registerExternalFiles();
  registerPdfExport();
  registerDocxExport();
  queueExternalFiles(process.argv.slice(app.isPackaged ? 1 : 2), process.cwd());

  if (app.isPackaged) {
    app.setAsDefaultProtocolClient("lunarscribe");
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
