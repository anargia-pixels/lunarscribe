/// <reference types="vite/client" />

interface Window {
  lunarscribe: {
    platform: string;
    listFiles: () => Promise<string[]>;
    readFile: (name: string) => Promise<string>;
    /**
     * Writes `<title>.md`, removing `previousName` if the title changed. Never overwrites
     * another file: on a clash it uses `<title>_N.md`. Returns the name saved under.
     */
    saveFile: (
      previousName: string | null,
      title: string,
      markdown: string,
    ) => Promise<string>;
    deleteFile: (name: string) => Promise<void>;
    onFilesChanged: (listener: (files: string[]) => void) => () => void;
  };
}
