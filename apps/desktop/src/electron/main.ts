import { join } from "node:path";

import { app, BrowserWindow, shell } from "electron";

import { registerDocumentsFolder } from "./documents-folder";

// Memory trims. A text editor needs no GPU, so compositing runs in software.
app.disableHardwareAcceleration();

// Runs that software compositor inside the main process instead of a GPU process.
app.commandLine.appendSwitch("in-process-gpu");

// Runs the network service inside the main process instead of a utility process.
app.commandLine.appendSwitch("enable-features", "NetworkServiceInProcess2");

// Skips V8's optimizing compiler, which this app's light JS does not need.
app.commandLine.appendSwitch("js-flags", "--lite-mode");

/** Opens the editor window and loads the renderer from Vite in dev or disk in production. */
function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 420,
    show: false,
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
  registerDocumentsFolder();
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
