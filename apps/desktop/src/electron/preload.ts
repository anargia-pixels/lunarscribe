import { contextBridge } from "electron";

/** Exposes a minimal, read-only surface to the renderer. */
contextBridge.exposeInMainWorld("lunarscribe", {
  platform: process.platform,
});
