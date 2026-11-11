import type { FileExtension } from "@lunarscribe/utils/file-kinds";
import type { FileSearchMatch } from "@lunarscribe/utils/file-search";
import type { SavedEntries } from "@lunarscribe/utils/saved-paths";
import type {
  SyncResult,
  SyncedFileChange,
} from "@lunarscribe/utils/sync/types";

import type {
  ExternalFile,
  OpenedExternalFile,
  WatchedFile,
  WatchedFileChange,
} from "./editor-files";
import type { ImageNote, ImageUpload, ResolvedImage } from "./images";
import type { SyncProvider, SyncStatus } from "./sync";
import type { AppInfo, UpdateCheck } from "./updates";

/**
 * The API the preload script exposes as `window.lunarscribe`. The preload checks its
 * implementation against this type, and the renderer reads it from env.d.ts.
 */
export type LunarscribeApi = {
  platform: string;
  getSyncStatus: () => Promise<SyncStatus>;
  connectSync: (provider: SyncProvider) => Promise<SyncStatus>;
  disconnectSync: () => Promise<SyncStatus>;
  syncFiles: (name: string | null) => Promise<SyncResult>;
  forceSyncFile: (name: string) => Promise<SyncResult>;
  /** Replaces the saved file with the remote copy and returns the change. */
  forcePullFile: (name: string) => Promise<SyncedFileChange>;
  cancelSyncSignIn: () => void;
  protectSyncFiles: (names: string[]) => void;
  /** Starts the one sync that runs when the app opens; later calls do nothing. */
  startupSync: () => void;
  onSyncStatus: (listener: (status: SyncStatus) => void) => () => void;
  onSyncResult: (listener: (result: SyncResult) => void) => () => void;
  onSyncedFiles: (
    listener: (changes: SyncedFileChange[]) => void,
  ) => () => void;
  getPathForFile: (file: File) => string;
  /** The URL of an image embed's file next to `note`, or why it can't be shown. */
  resolveImage: (note: ImageNote, target: string) => Promise<ResolvedImage>;
  /** Copies images next to `note` without overwriting; returns their embed targets. */
  saveImages: (note: ImageNote, uploads: ImageUpload[]) => Promise<string[]>;
  /** Scales the window, where 1 is 100%. */
  setZoomFactor: (factor: number) => void;
  /** Versions and folders for the About pane. */
  getAppInfo: () => Promise<AppInfo>;
  /** Asks GitHub for a newer release. */
  checkForUpdate: () => Promise<UpdateCheck>;
  /** Downloads and installs the latest release over this copy; `error` explains a failure. */
  installUpdate: () => Promise<{ error: string | null }>;
  /** Restarts into the installed update. */
  restartApp: () => void;
  readExternalFile: (path: string) => Promise<OpenedExternalFile>;
  saveExternalFile: (path: string, markdown: string) => Promise<void>;
  renameExternalFile: (
    path: string,
    sourcePath: string,
    title: string,
  ) => Promise<ExternalFile>;
  onExternalFilesOpened: (listener: (paths: string[]) => void) => () => void;
  /** Saved files and folders, named by their paths inside the documents folder. */
  listFiles: () => Promise<SavedEntries>;
  searchFiles: (
    query: string,
    isContentSearch: boolean,
  ) => Promise<FileSearchMatch[]>;
  getFilePath: (name: string) => Promise<string>;
  /** Shows `path` in the OS file manager, selecting it. */
  showInFolder: (path: string) => Promise<void>;
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
    extension: FileExtension,
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
  onFilesChanged: (listener: (entries: SavedEntries) => void) => () => void;
  /** Replaces the files the file watcher follows. */
  watchFiles: (files: WatchedFile[]) => void;
  onWatchedFileChanged: (
    listener: (change: WatchedFileChange) => void,
  ) => () => void;
};
