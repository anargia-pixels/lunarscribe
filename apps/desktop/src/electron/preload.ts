import { contextBridge, ipcRenderer, webUtils } from "electron";

import type { FileExtension, OpenedExternalFile } from "../lib/editor-files";

/** Exposes file operations and lifecycle events without Node access in the renderer. */
contextBridge.exposeInMainWorld("lunarscribe", {
  platform: process.platform,
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  readExternalFile: (path: string): Promise<OpenedExternalFile> =>
    ipcRenderer.invoke("external-files:read", path),
  saveExternalFile: (path: string, markdown: string): Promise<void> =>
    ipcRenderer.invoke("external-files:save", path, markdown),
  onExternalFilesOpened: (listener: (paths: string[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, paths: string[]) =>
      listener(paths);

    ipcRenderer.on("external-files:opened", handler);
    ipcRenderer.send("external-files:ready");

    return () => {
      ipcRenderer.off("external-files:opened", handler);
      ipcRenderer.send("external-files:paused");
    };
  },
  listFiles: () => ipcRenderer.invoke("files:list"),
  readFile: (name: string) => ipcRenderer.invoke("files:read", name),
  saveFile: (
    previousName: string | null,
    title: string,
    extension: FileExtension,
    content: string,
  ): Promise<string> =>
    ipcRenderer.invoke("files:save", previousName, title, extension, content),
  deleteFile: (name: string) => ipcRenderer.invoke("files:delete", name),
  onFilesChanged: (listener: (files: string[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, files: string[]) =>
      listener(files);

    ipcRenderer.on("files:changed", handler);

    return () => ipcRenderer.off("files:changed", handler);
  },
});
