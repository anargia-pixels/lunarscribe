// Provider contracts
export type RemoteFile = {
  content: string;
  revision: string;
  id?: string; // Drive uses this locator for conditional writes.
  blocked?: boolean;
};

export type RemoteFiles = Map<string, RemoteFile>;

export type RemoteChange = {
  name: string;
  content: string | null;
};

/** Pause background sync until the user signs in again. */
export class SyncSignInRequired extends Error {}

/** Each adapter rejects writes if its snapshot revision is stale. */
export type FileSyncProvider = {
  read: () => Promise<RemoteFiles>;
  write: (changes: RemoteChange[], snapshot: RemoteFiles) => Promise<void>;
};
