import { contextBridge, ipcRenderer } from "electron";

/** Exposes the platform and the documents folder to the renderer. */
contextBridge.exposeInMainWorld("lunarscribe", {
  platform: process.platform,
  listFiles: () => ipcRenderer.invoke("files:list"),
  readFile: (name: string) => ipcRenderer.invoke("files:read", name),
  saveFile: (
    previousName: string | null,
    title: string,
    extension: string,
    content: string,
  ) =>
    ipcRenderer.invoke("files:save", previousName, title, extension, content),
  deleteFile: (name: string) => ipcRenderer.invoke("files:delete", name),
  onFilesChanged: (listener: (files: string[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, files: string[]) =>
      listener(files);

    ipcRenderer.on("files:changed", handler);

    return () => ipcRenderer.off("files:changed", handler);
  },
});
