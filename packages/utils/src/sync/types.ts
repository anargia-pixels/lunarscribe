// Provider contracts
export type RemoteFile = {
  content: string;
  revision: string;
  modifiedAt: number;
  modifiedAtPrecisionMs: number;
  id?: string; // Drive uses this locator for conditional writes.
  blocked?: boolean;
};

export type RemoteFiles = Map<string, RemoteFile>;

export type RemoteChange =
  | { name: string; content: string; modifiedAt: number }
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
    content: string,
    modifiedAt: number,
  ) => Promise<void>;
};
