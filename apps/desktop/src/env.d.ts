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
    /** Replaces the saved file with the remote copy and returns the change. */
    forcePullFile: (
      name: string,
    ) => Promise<import("./lib/sync").SyncedFileChange>;
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
    /** The URL of an image embed's file next to `note`, or why it can't be shown. */
    resolveImage: (
      note: import("./lib/images").ImageNote,
      target: string,
    ) => Promise<import("./lib/images").ResolvedImage>;
    /** Copies images next to `note` without overwriting; returns their embed targets. */
    saveImages: (
      note: import("./lib/images").ImageNote,
      uploads: import("./lib/images").ImageUpload[],
    ) => Promise<string[]>;
    /** Scales the window, where 1 is 100%. */
    setZoomFactor: (factor: number) => void;
    /** Versions and folders for the About pane. */
    getAppInfo: () => Promise<import("./lib/updates").AppInfo>;
    /** Asks GitHub for a newer release. */
    checkForUpdate: () => Promise<import("./lib/updates").UpdateCheck>;
    /** Downloads and installs the latest release over this copy; `error` explains a failure. */
    installUpdate: () => Promise<{ error: string | null }>;
    /** Restarts into the installed update. */
    restartApp: () => void;
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
    /** Saved files and folders, named by their paths inside the documents folder. */
    listFiles: () => Promise<
      import("@lunarscribe/utils/saved-paths").SavedEntries
    >;
    searchFiles: (
      query: string,
      isContentSearch: boolean,
    ) => Promise<import("./lib/editor-files").FileSearchMatch[]>;
    getFilePath: (name: string) => Promise<string>;
    readFile: (name: string) => Promise<string>;
    exportPdf: (title: string, html: string) => Promise<string | null>;
    exportDocx: (title: string, bytes: Uint8Array) => Promise<string | null>;
    /**
     * Writes `<title><extension>` in the folder of `previousName`, or in `folder` for a new
     * file, removing `previousName` if the title changed. Never overwrites another file: on
     * a clash it uses `<title>_N<extension>`. Returns the name saved under.
     */
    saveFile: (
      previousName: string | null,
      folder: string,
      title: string,
      extension: import("./lib/editor-files").FileExtension,
      content: string,
      expectedContent: string | null,
    ) => Promise<string>;
    /** Renames a saved image to `<title><its extension>` in its folder; returns its new name. */
    renameImage: (name: string, title: string) => Promise<string>;
    /** Moves a saved file into `folder` (`""` for the top level); returns its new name. */
    moveFile: (name: string, folder: string) => Promise<string>;
    deleteFile: (name: string) => Promise<void>;
    /** Creates a folder named `name` inside `parent`; returns its path. */
    createFolder: (parent: string, name: string) => Promise<string>;
    /** Renames a folder in place; returns its new path. */
    renameFolder: (path: string, name: string) => Promise<string>;
    /** Deletes a folder and everything inside it. */
    deleteFolder: (path: string) => Promise<void>;
    onFilesChanged: (
      listener: (
        entries: import("@lunarscribe/utils/saved-paths").SavedEntries,
      ) => void,
    ) => () => void;
    /** Replaces the files the file watcher follows. */
    watchFiles: (files: import("./lib/editor-files").WatchedFile[]) => void;
    onWatchedFileChanged: (
      listener: (
        change: import("./lib/editor-files").WatchedFileChange,
      ) => void,
    ) => () => void;
  };
}
