/// <reference types="vite/client" />

/** The desktop package version, set by electron-vite at build time. */
declare const __APP_VERSION__: string;

interface Window {
  /** Chromium's Local Font Access API; only the family names are needed. */
  queryLocalFonts?: () => Promise<{ family: string }[]>;
  /** Base URLs Excalidraw loads its fonts from; set to the bundled copy so drawings work offline. */
  EXCALIDRAW_ASSET_PATH?: string | string[];
  lunarscribe: {
    platform: string;
    getSyncStatus: () => Promise<import("./lib/sync").SyncStatus>;
    connectSync: (
      provider: import("./lib/sync").SyncProvider,
    ) => Promise<import("./lib/sync").SyncStatus>;
    disconnectSync: () => Promise<import("./lib/sync").SyncStatus>;
    syncFiles: (
      name: string | null,
    ) => Promise<import("./lib/sync").SyncResult>;
    forceSyncFile: (name: string) => Promise<import("./lib/sync").SyncResult>;
    cancelSyncSignIn: () => void;
    protectSyncFiles: (names: string[]) => void;
    /** Starts the one sync that runs when the app opens; later calls do nothing. */
    startupSync: () => void;
    onSyncStatus: (
      listener: (status: import("./lib/sync").SyncStatus) => void,
    ) => () => void;
    onSyncResult: (
      listener: (result: import("./lib/sync").SyncResult) => void,
    ) => () => void;
    onSyncedFiles: (
      listener: (changes: import("./lib/sync").SyncedFileChange[]) => void,
    ) => () => void;
    getPathForFile: (file: File) => string;
    /** Chromium zoom level, where 0 is 100% and each level scales by 20%. */
    setZoomLevel: (level: number) => void;
    readExternalFile: (
      path: string,
    ) => Promise<import("./lib/editor-files").OpenedExternalFile>;
    saveExternalFile: (path: string, markdown: string) => Promise<void>;
    renameExternalFile: (
      path: string,
      sourcePath: string,
      title: string,
    ) => Promise<import("./lib/editor-files").ExternalFile>;
    onExternalFilesOpened: (listener: (paths: string[]) => void) => () => void;
    listFiles: () => Promise<string[]>;
    searchFiles: (
      query: string,
      isContentSearch: boolean,
    ) => Promise<import("./lib/editor-files").FileSearchMatch[]>;
    getFilePath: (name: string) => Promise<string>;
    readFile: (name: string) => Promise<string>;
    exportPdf: (title: string, html: string) => Promise<string | null>;
    exportDocx: (title: string, bytes: Uint8Array) => Promise<string | null>;
    /**
     * Writes `<title><extension>`, removing `previousName` if the
     * title changed. Never overwrites another file: on a clash it uses `<title>_N<extension>`.
     * Returns the name saved under.
     */
    saveFile: (
      previousName: string | null,
      title: string,
      extension: import("./lib/editor-files").FileExtension,
      content: string,
      expectedContent: string | null,
    ) => Promise<string>;
    deleteFile: (name: string) => Promise<void>;
    onFilesChanged: (listener: (files: string[]) => void) => () => void;
  };
}
