export type RemoteFile = {
  content: string;
  revision: string;
  blocked?: boolean;
};

export type RemoteFiles = Map<string, RemoteFile>;

export type RemoteChange = {
  name: string;
  content: string | null;
};

export class SyncSignInRequired extends Error {}

/** Each provider rejects writes if the remote revision has changed since read. */
export interface FileSyncProvider {
  read: () => Promise<RemoteFiles>;
  write: (changes: RemoteChange[], snapshot: RemoteFiles) => Promise<void>;
}
