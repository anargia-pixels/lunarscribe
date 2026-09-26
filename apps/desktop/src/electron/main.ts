import { join } from "node:path";

import { app, BrowserWindow, shell } from "electron";

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
      preload: join(__dirname, "../preload/preload.mjs"),
      sandbox: false,
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
