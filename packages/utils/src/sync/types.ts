// Provider contracts
/** Markdown and drawings sync as text; images sync as their bytes. */
export type SyncContent = string | Uint8Array<ArrayBuffer>;

/** Whether two copies of a synced file hold the same text or bytes. */
export function isSameSyncContent(
  first: SyncContent | null | undefined,
  second: SyncContent | null | undefined,
) {
  if (!(first instanceof Uint8Array) || !(second instanceof Uint8Array)) {
    return first === second;
  }

  return (
    first.length === second.length &&
    first.every((byte, index) => byte === second[index])
  );
}

export type RemoteFile = {
  content: SyncContent;
  revision: string;
  modifiedAt: number;
  modifiedAtPrecisionMs: number;
  id?: string; // Drive uses this locator for conditional writes.
  blocked?: boolean;
};

export type RemoteFiles = Map<string, RemoteFile>;

export type RemoteChange =
  | { name: string; content: SyncContent; modifiedAt: number }
  | { name: string; content: null };

/** Pause background sync until the user signs in again. */
export class SyncSignInRequired extends Error {}

/** Remote requests each provider runs at once during a sync. */
export const SYNC_CONCURRENCY = 6;

/** Normal writes check revisions; explicit overwrites use the local copy. */
export type FileSyncProvider = {
  /** Download every saved file, or only `name` when one file is synced. */
  read: (name: string | null) => Promise<RemoteFiles>;
  write: (changes: RemoteChange[], snapshot: RemoteFiles) => Promise<void>;
  forceWrite: (
    name: string,
    content: SyncContent,
    modifiedAt: number,
  ) => Promise<void>;
};

// Sync state shared with the UI
/** Cloud providers every app can sign in to, by name in messages. */
export const CLOUD_SYNC_PROVIDER_NAMES = {
  "google-drive": "Google Drive",
  dropbox: "Dropbox",
} as const;

/** The provider labels in sync settings, which mark the providers as unfinished. */
export const CLOUD_SYNC_PROVIDERS = {
  "google-drive": `${CLOUD_SYNC_PROVIDER_NAMES["google-drive"]} - WIP`,
  dropbox: `${CLOUD_SYNC_PROVIDER_NAMES.dropbox} - WIP`,
} as const;

export type CloudSyncProvider = keyof typeof CLOUD_SYNC_PROVIDERS;

export function isCloudSyncProvider(value: string): value is CloudSyncProvider {
  return Object.hasOwn(CLOUD_SYNC_PROVIDERS, value);
}

/** The last acknowledged hash distinguishes a remote edit from a local edit. */
export type SyncBaseline = Record<string, string>;

export type SyncConflict = {
  name: string;
  reason: string;
};

export type SyncResult = {
  conflicts: SyncConflict[];
  pushed: number;
  pulled: number;
};

/** A saved text file that sync changed; null means the file did not exist. */
export type SyncedFileChange = {
  name: string;
  before: string | null;
  after: string | null;
};

export type SyncStatus<Provider extends string = CloudSyncProvider> = {
  provider: Provider | null;
  account: string | null;
  isBusy: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  isSignInRequired: boolean;
};
