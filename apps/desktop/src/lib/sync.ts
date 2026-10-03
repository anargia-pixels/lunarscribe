export const SYNC_PROVIDERS = {
  github: "GitHub",
  "google-drive": "Google Drive - WIP",
  dropbox: "Dropbox - WIP",
} as const;

export type SyncProvider = keyof typeof SYNC_PROVIDERS;

export type SyncStatus = {
  provider: SyncProvider | null;
  account: string | null;
  busy: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  needsSignIn: boolean;
};

export type SyncedFileChange = {
  name: string;
  before: string | null;
  after: string | null;
};

export type SyncResult = {
  conflicts: SyncConflict[];
  pushed: number;
  pulled: number;
};

export type SyncConflict = {
  name: string;
  reason: string;
};

/** The last acknowledged hash distinguishes a remote edit from a local edit. */
export type SyncBaseline = Record<string, string>;
