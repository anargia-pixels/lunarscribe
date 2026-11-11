import { errorMessage } from "../error-message";
import { isSavedFileName } from "../file-kinds";
import { createDropboxApi } from "./dropbox";
import { createGoogleDriveApi } from "./google-drive";
import { sha256Hex } from "./hash";
import type { ContentHash } from "./hash";
import { isExpiring } from "./oauth";
import type { OAuthTokens } from "./oauth";
import { forcePullFile, forcePushFile, syncWithCloud } from "./plan";
import type { LocalSyncFile, LocalSyncStore } from "./plan";
import { createEmptySettings } from "./settings";
import type { SyncSettings, SyncSettingsStore } from "./settings";
import { SyncSignInRequired } from "./types";
import type {
  CloudSyncProvider,
  FileSyncProvider,
  SyncedFileChange,
  SyncResult,
  SyncStatus,
} from "./types";

// Backends
/** What one operation may read and change while it holds the sync lock. */
export type SyncSession<Provider extends string = CloudSyncProvider> = {
  settings: SyncSettings<Provider>;
  /** Store `settings` now, such as right after a token refresh. */
  saveSettings: () => Promise<void>;
  getProtectedNames: () => Set<string>;
  /** Report saved text files a sync changed, so buffers reload them. */
  emitFiles: (changes: SyncedFileChange[]) => void;
};

/** One kind of destination: a cloud provider, or the desktop app's Git repository. */
export type SyncBackend<Provider extends string = CloudSyncProvider> = {
  /** Whether the stored settings still allow syncing without a new sign-in. */
  isSignedIn: (settings: SyncSettings<Provider>) => boolean;
  /** Sign in or set up the destination; returns the settings that name it. */
  connect: (
    signal: AbortSignal,
  ) => Promise<Pick<SyncSettings<Provider>, "account" | "folderId" | "tokens">>;
  /** Release the destination; the service clears the settings afterwards. */
  disconnect: (settings: SyncSettings<Provider>) => Promise<void>;
  sync: (
    session: SyncSession<Provider>,
    name: string | null,
  ) => Promise<SyncResult>;
  forcePush: (session: SyncSession<Provider>, name: string) => Promise<void>;
  forcePull: (
    session: SyncSession<Provider>,
    name: string,
  ) => Promise<SyncedFileChange>;
};

/** Each app's OAuth flow for one cloud provider. */
export type CloudAuth = {
  signIn: (signal: AbortSignal) => Promise<OAuthTokens>;
  refresh: (tokens: OAuthTokens) => Promise<OAuthTokens>;
  /** End the grant on disconnect; apps without it only forget the tokens. */
  revoke?: (tokens: OAuthTokens) => Promise<void>;
};

/** A Google Drive or Dropbox backend over the app's saved files. */
export function createCloudBackend<
  File extends LocalSyncFile,
  Provider extends string = CloudSyncProvider,
>(
  provider: CloudSyncProvider,
  auth: CloudAuth,
  local: LocalSyncStore<File>,
  hash: ContentHash = sha256Hex,
): SyncBackend<Provider> {
  /** Refresh expiring tokens, or require sign-in when there is no refresh token. */
  async function getAccessToken(session: SyncSession<Provider>) {
    const { settings } = session;

    if (!settings.tokens) {
      throw new SyncSignInRequired("Reconnect your sync account.");
    }

    if (isExpiring(settings.tokens)) {
      if (!settings.tokens.refreshToken) {
        throw new SyncSignInRequired(
          "Your sync account needs sign-in again. Open the sync settings and select Sign in again. Your writing is safe.",
        );
      }

      settings.tokens = await auth.refresh(settings.tokens);
      await session.saveSettings();
    }

    return settings.tokens.accessToken;
  }

  /** The provider API for the stored destination. */
  function open(session: SyncSession<Provider>): FileSyncProvider {
    const accessToken = () => getAccessToken(session);

    if (provider === "dropbox") {
      return createDropboxApi(accessToken).createProvider();
    }

    if (!session.settings.folderId) {
      throw new SyncSignInRequired(
        "The Google Drive folder is unknown. Disconnect and connect again.",
      );
    }

    return createGoogleDriveApi(accessToken, hash).createProvider(
      session.settings.folderId,
    );
  }

  return {
    isSignedIn: (settings) => settings.tokens !== null,
    async connect(signal) {
      const tokens = await auth.signIn(signal);
      const accessToken = async () => tokens.accessToken;

      if (provider === "dropbox") {
        const account = await createDropboxApi(accessToken).connect();

        return { account, folderId: null, tokens };
      }

      const api = createGoogleDriveApi(accessToken, hash);
      const folderId = await api.getOrCreateFolder();

      return { account: await api.getAccountEmail(), folderId, tokens };
    },
    async disconnect(settings) {
      if (auth.revoke && settings.tokens) {
        // Best effort: disconnect still works offline or after the user revoked access.
        await auth.revoke(settings.tokens).catch(() => undefined);
      }
    },
    async sync(session, name) {
      const { result, baseline } = await syncWithCloud(
        open(session),
        local,
        session.settings.baseline,
        session.getProtectedNames,
        name,
        (change) => session.emitFiles([change]),
        hash,
      );

      session.settings.baseline = baseline;

      return result;
    },
    forcePush: (session, name) =>
      forcePushFile(
        open(session),
        local,
        session.settings.baseline,
        name,
        hash,
      ),
    forcePull: (session, name) =>
      forcePullFile(
        open(session),
        local,
        session.settings.baseline,
        name,
        hash,
      ),
  };
}

// Service
/** Another tab or window holds the sync lock; background runs skip quietly. */
export class SyncLockHeld extends Error {}

export type SyncServiceOptions<Provider extends string> = {
  backends: Record<Provider, SyncBackend<Provider>>;
  settings: SyncSettingsStore<Provider>;
  /** Saved files whose open buffers have pending edits, in every window or tab. */
  getProtectedNames: () => Set<string>;
  /** Run one operation at a time across processes; throws `SyncLockHeld` when taken. */
  lock?: <T>(operation: () => Promise<T>) => Promise<T>;
};

/**
 * Sync state and operations shared by every app. Each operation reloads the settings,
 * since another tab or window may have changed them, and allows one run at a time.
 * Events reach only this process; each app forwards them to its other windows or tabs.
 */
export function createSyncService<Provider extends string>(
  options: SyncServiceOptions<Provider>,
) {
  const { backends, settings: store, getProtectedNames } = options;
  const lock = options.lock ?? ((operation) => operation());
  const statusListeners = new Set<(status: SyncStatus<Provider>) => void>();
  const resultListeners = new Set<(result: SyncResult) => void>();
  const filesListeners = new Set<(changes: SyncedFileChange[]) => void>();
  let settings = createEmptySettings<Provider>();
  let isBusy = false;
  let error: string | null = null;
  let isSignInRequired = false;
  let authorization: AbortController | null = null;

  // State and events
  function getStatus(): SyncStatus<Provider> {
    return {
      provider: settings.provider,
      account: settings.account,
      isBusy,
      lastSyncedAt: settings.lastSyncedAt,
      error,
      isSignInRequired,
    };
  }

  function emit<T>(listeners: Set<(value: T) => void>, value: T) {
    for (const listener of listeners) {
      listener(value);
    }
  }

  function subscribe<T>(listeners: Set<(value: T) => void>) {
    return (listener: (value: T) => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    };
  }

  /** Read the stored settings, which another tab or window may have changed. */
  async function load() {
    settings = await store.load();

    isSignInRequired =
      settings.provider !== null &&
      !backends[settings.provider].isSignedIn(settings);
  }

  /** Reload the settings for the status; a load failure becomes its error. */
  async function reload() {
    // A running operation holds the settings it changes; it reloads them itself.
    if (isBusy) {
      return;
    }

    try {
      await load();

      error = isSignInRequired
        ? "Sign-in is required. Open the sync settings and select Sign in again."
        : null;
    } catch (cause) {
      error = errorMessage(cause, "Unable to load sync settings.");
    }

    emit(statusListeners, getStatus());
  }

  const ready = reload();

  // Operations
  /**
   * How an operation treats failures: a background run skips quietly when another
   * process holds the lock, and connect or disconnect replace settings that fail to load.
   */
  type RunKind = "foreground" | "background" | "replace";

  /** Allow one operation at a time and report its status. */
  async function run<T>(
    operation: (backend: SyncBackend<Provider> | null) => Promise<T>,
    kind: RunKind = "foreground",
  ) {
    await ready;

    if (isBusy) {
      throw new Error(
        "A sync operation is already running. Try again when it finishes.",
      );
    }

    isBusy = true;
    error = null;
    emit(statusListeners, getStatus());

    try {
      return await lock(async () => {
        try {
          await load();
        } catch (cause) {
          if (kind !== "replace") {
            throw cause;
          }

          settings = createEmptySettings<Provider>();
        }

        return operation(settings.provider && backends[settings.provider]);
      });
    } catch (cause) {
      if (kind === "background" && cause instanceof SyncLockHeld) {
        throw cause;
      }

      if (cause instanceof SyncSignInRequired) {
        isSignInRequired = true;
      }

      error = errorMessage(cause, "Sync failed. Your local writing is safe.");
      throw new Error(error);
    } finally {
      isBusy = false;
      emit(statusListeners, getStatus());
    }
  }

  function session(): SyncSession<Provider> {
    return {
      settings,
      saveSettings: () => store.save(settings),
      getProtectedNames,
      emitFiles: (changes) => emit(filesListeners, changes),
    };
  }

  /** The connected backend; rejects names cloud sync must not read or write. */
  function connected(
    backend: SyncBackend<Provider> | null,
    name: string | null,
  ) {
    if (!backend) {
      throw new Error("Connect a sync provider first.");
    }

    if (name !== null && !isSavedFileName(name)) {
      throw new Error("Only saved markdown and drawings can be synced.");
    }

    return backend;
  }

  async function finish(result: SyncResult) {
    settings.lastSyncedAt = new Date().toISOString();
    await store.save(settings);
    emit(resultListeners, result);

    return result;
  }

  /** Sync every saved file, or push only `name`. */
  function sync(name: string | null, isBackground = false) {
    return run(
      async (backend) =>
        finish(await connected(backend, name).sync(session(), name)),
      isBackground ? "background" : "foreground",
    );
  }

  /** Overwrite the remote copy with the saved file. */
  function forcePush(name: string) {
    return run(async (backend) => {
      await connected(backend, name).forcePush(session(), name);

      return finish({ conflicts: [], pushed: 1, pulled: 0 });
    });
  }

  /**
   * Replace the saved file with the remote copy, or remove it when the remote has none.
   * The caller applies the returned change; other windows need it forwarded.
   */
  function forcePull(name: string) {
    return run(async (backend) => {
      const change = await connected(backend, name).forcePull(session(), name);
      await finish({ conflicts: [], pushed: 0, pulled: 1 });

      return change;
    });
  }

  /** Sign in to `provider` and store its destination. */
  async function connect(provider: Provider) {
    await run(async () => {
      if (!Object.hasOwn(backends, provider)) {
        throw new Error("Unknown sync provider.");
      }

      authorization = new AbortController();
      const next = createEmptySettings<Provider>();

      try {
        Object.assign(
          next,
          await backends[provider].connect(authorization.signal),
        );

        if (authorization.signal.aborted) {
          throw new Error("Sign-in cancelled.");
        }
      } finally {
        authorization = null;
      }

      next.provider = provider;

      // Keep comparison history when the same destination reconnects.
      if (
        settings.provider === next.provider &&
        settings.account === next.account &&
        settings.folderId === next.folderId
      ) {
        next.baseline = settings.baseline;
        next.lastSyncedAt = settings.lastSyncedAt;
      }

      await store.save(next);
      settings = next;
      isSignInRequired = false;
    }, "replace");

    return getStatus();
  }

  async function disconnect() {
    await run(async (backend) => {
      await backend?.disconnect(settings);
      const next = createEmptySettings<Provider>();
      await store.save(next);
      settings = next;
      isSignInRequired = false;
    }, "replace");

    return getStatus();
  }

  /** Sync now unless sync is off, waiting for sign-in, or already running. */
  async function syncInBackground() {
    await ready;

    if (settings.provider && !isSignInRequired && !isBusy) {
      // Failures are already in the status, which the UI shows.
      await sync(null, true).catch(() => undefined);
    }
  }

  return {
    ready,
    getStatus,
    reload,
    sync,
    forcePush,
    forcePull,
    connect,
    disconnect,
    cancelSignIn: () => authorization?.abort(),
    syncInBackground,
    onStatus: subscribe(statusListeners),
    onResult: subscribe(resultListeners),
    onFiles: subscribe(filesListeners),
  };
}

export type SyncService<Provider extends string> = ReturnType<
  typeof createSyncService<Provider>
>;
