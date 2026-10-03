/// <reference types="vite/client" />

interface Window {
  /** Chromium's Local Font Access API; only the family names are needed. */
  queryLocalFonts?: () => Promise<{ family: string }[]>;
  /** Base URLs Excalidraw loads its fonts from; set to the bundled copy so drawings work offline. */
  EXCALIDRAW_ASSET_PATH?: string | string[];
  lunarscribe: {
    platform: string;
    getPathForFile: (file: File) => string;
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
    ) => Promise<string>;
    deleteFile: (name: string) => Promise<void>;
    onFilesChanged: (listener: (files: string[]) => void) => () => void;
  };
}
