/// <reference types="vite/client" />

/** The desktop package version, set by electron-vite at build time. */
declare const __APP_VERSION__: string;

interface Window {
  /** Chromium's Local Font Access API; only the family names are needed. */
  queryLocalFonts?: () => Promise<{ family: string }[]>;
  /** Base URLs Excalidraw loads its fonts from; set to the bundled copy so drawings work offline. */
  EXCALIDRAW_ASSET_PATH?: string | string[];
  lunarscribe: import("./lib/bridge").LunarscribeApi;
}
