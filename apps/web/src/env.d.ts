/// <reference types="vite/client" />

/** File System Access API members that TypeScript's DOM library omits (Chromium only). */
type FileSystemPermissionMode = { mode: "read" | "readwrite" };

interface FileSystemHandle {
  queryPermission?: (
    descriptor: FileSystemPermissionMode,
  ) => Promise<PermissionState>;
  requestPermission?: (
    descriptor: FileSystemPermissionMode,
  ) => Promise<PermissionState>;
}

interface FileSystemFileHandle {
  move?: (name: string) => Promise<void>;
}

interface DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
}

type OpenFilePickerOptions = {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: { description: string; accept: Record<string, string[]> }[];
};

/** Files an installed web app receives through the manifest's file handlers. */
type LaunchParams = { files: readonly FileSystemHandle[] };

interface Window {
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
  launchQueue?: {
    setConsumer: (consumer: (params: LaunchParams) => void) => void;
  };
  /** Google Identity Services, loaded on demand for Google Drive sign-in. */
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          prompt?: string;
          callback: (response: {
            access_token?: string;
            expires_in?: number | string;
            error?: string;
          }) => void;
          error_callback?: (error: { type: string }) => void;
        }) => { requestAccessToken: () => void };
      };
    };
  };
}
