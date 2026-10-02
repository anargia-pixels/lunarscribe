/// <reference types="vite/client" />

interface Window {
  /** Chromium's Local Font Access API; only the family names are needed. */
  queryLocalFonts?: () => Promise<{ family: string }[]>;
  /** Base URLs Excalidraw loads its fonts from; set to the bundled copy so drawings work offline. */
  EXCALIDRAW_ASSET_PATH?: string | string[];
  lunarscribe: {
    platform: string;
    listFiles: () => Promise<string[]>;
    readFile: (name: string) => Promise<string>;
    /**
     * Writes `<title><extension>` (`.md` or `.draw`), removing `previousName` if the
     * title changed. Never overwrites another file: on a clash it uses `<title>_N<extension>`.
     * Returns the name saved under.
     */
    saveFile: (
      previousName: string | null,
      title: string,
      extension: ".md" | ".draw",
      content: string,
    ) => Promise<string>;
    deleteFile: (name: string) => Promise<void>;
    onFilesChanged: (listener: (files: string[]) => void) => () => void;
  };
}
