import { errorMessage } from "@lunarscribe/utils/error-message";
import type { FileSyncProvider } from "@lunarscribe/utils/sync/types";
import { SyncSignInRequired } from "@lunarscribe/utils/sync/types";

import { createDropboxApi } from "@/lib/sync/dropbox";
import {
  applySyncPulls,
  contentHash,
  isSavedFileName,
  planSync,
  readLocalSyncFiles,
} from "@/lib/sync/files";
import { createGoogleDriveApi } from "@/lib/sync/google-drive";
import { refreshDropboxTokens, signIn } from "@/lib/sync/oauth";
import publicCredentials from "@/lib/sync/public-creds.json";
import {
  createEmptySettings,
  loadSyncSettings,
  saveSyncSettings,
  SYNC_SETTINGS_KEY,
} from "@/lib/sync/settings";
import type { SyncSettings } from "@/lib/sync/settings";
import { SYNC_PROVIDERS } from "@/lib/sync/sync-types";
import type {
  SyncedFileChange,
  SyncProvider,
  SyncResult,
  SyncStatus,
} from "@/lib/sync/sync-types";

/**
 * Browser counterpart of the desktop sync service. Each tab runs its own copy; a Web Lock
 * lets one tab sync at a time, and a broadcast channel shares results, pulled files and
 * buffers with pending edits between tabs.
 */

// Background schedule
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

const SYNC_LOCK = "lunarscribe-sync";

type TabMessage =
  | { type: "result"; result: SyncResult }
  | { type: "files"; changes: SyncedFileChange[] }
  | { type: "protected"; tabId: string; names: string[] };

const tabId = crypto.randomUUID();

const channel = new BroadcastChannel("lunarscribe-sync");

const statusListeners = new Set<(status: SyncStatus) => void>();

const resultListeners = new Set<(result: SyncResult) => void>();

const filesListeners = new Set<(changes: SyncedFileChange[]) => void>();

let settings = createEmptySettings();

let isBusy = false;

let error: string | null = null;

let needsSignIn = false;

let authorization: AbortController | null = null;

const protectedByTab = new Map<string, Set<string>>();

/** Reads the settings every tab shares; called before each operation. */
function reloadSettings() {
  try {
    settings = loadSyncSettings();
    needsSignIn = settings.provider !== null && settings.tokens === null;

    if (needsSignIn) {
      error =
        "Sign-in is required. Open Settings → Syncing and select Sign in again.";
    }
  } catch (cause) {
    error = errorMessage(cause, "Unable to load sync settings.");
  }
}

reloadSettings();

// Public API, matching the desktop preload bridge.
export function getSyncStatus(): SyncStatus {
  return {
    provider: settings.provider,
    account: settings.account,
    busy: isBusy,
    lastSyncedAt: settings.lastSyncedAt,
    error,
    needsSignIn,
  };
}

function emit<T>(listeners: Set<(value: T) => void>, value: T) {
  for (const listener of listeners) {
    listener(value);
  }
}

function emitStatus() {
  emit(statusListeners, getSyncStatus());
}

function emitResult(result: SyncResult) {
  emit(resultListeners, result);
  channel.postMessage({ type: "result", result } satisfies TabMessage);
}

function emitFiles(changes: SyncedFileChange[]) {
  emit(filesListeners, changes);
  channel.postMessage({ type: "files", changes } satisfies TabMessage);
}

channel.addEventListener("message", (event: MessageEvent<TabMessage>) => {
  const message = event.data;

  if (message.type === "result") {
    emit(resultListeners, message.result);
  } else if (message.type === "files") {
    emit(filesListeners, message.changes);
  } else {
    protectedByTab.set(message.tabId, new Set(message.names));
  }
});

// Another tab connected, disconnected, or finished a sync.
window.addEventListener("storage", (event) => {
  if (event.key === SYNC_SETTINGS_KEY && !isBusy) {
    error = null;
    reloadSettings();
    emitStatus();
  }
});

window.addEventListener("pagehide", () => {
  authorization?.abort();
  channel.postMessage({
    type: "protected",
    tabId,
    names: [],
  } satisfies TabMessage);
});

// Access tokens
/** Refresh expired Dropbox tokens; Google tokens require sign-in again. */
async function getAccessToken(provider: SyncProvider) {
  if (!settings.tokens || settings.provider !== provider) {
    throw new SyncSignInRequired("Reconnect your sync account.");
  }

  let tokens = settings.tokens;

  if (tokens.expiresAt <= Date.now() + 60_000) {
    if (!tokens.refreshToken) {
      throw new SyncSignInRequired(
        "Google Drive needs sign-in again. Open Settings → Syncing and select Sign in again. Your writing is safe.",
      );
    }

    tokens = await refreshDropboxTokens(tokens);
    settings.tokens = tokens;
    saveSyncSettings(settings);
  }

  return tokens.accessToken;
}

/** Build a cloud adapter with the current token and saved destination. */
function createCloudProvider(): FileSyncProvider {
  if (settings.provider === "google-drive" && settings.folderId) {
    return createGoogleDriveApi(() =>
      getAccessToken("google-drive"),
    ).createProvider(settings.folderId);
  }

  if (settings.provider === "dropbox") {
    return createDropboxApi(() => getAccessToken("dropbox")).createProvider();
  }

  throw new Error("Connect a sync provider first.");
}

// Sync operations
/** Another tab holds the sync lock. */
class SyncLockHeld extends Error {}

/** Allow one sync operation across tabs and report its status. */
async function runSyncOperation<T>(
  operation: () => Promise<T>,
  isBackground = false,
) {
  if (isBusy) {
    throw new Error(
      "A sync operation is already running. Try again when it finishes.",
    );
  }

  isBusy = true;
  reloadSettings();
  error = null;
  emitStatus();

  try {
    return await navigator.locks.request(
      SYNC_LOCK,
      { ifAvailable: true },
      (lock) => {
        if (!lock) {
          throw new SyncLockHeld(
            "Another Lunarscribe tab is syncing. Try again when it finishes.",
          );
        }

        return operation();
      },
    );
  } catch (cause) {
    // A background run skips without an error when another tab syncs.
    if (isBackground && cause instanceof SyncLockHeld) {
      throw cause;
    }

    if (cause instanceof SyncSignInRequired) {
      needsSignIn = true;
    }

    error = errorMessage(cause, "Sync failed. Your local writing is safe.");
    throw new Error(error);
  } finally {
    isBusy = false;
    emitStatus();
  }
}

/** Protect pending buffer edits across all open tabs. */
function getProtectedNames() {
  return new Set([...protectedByTab.values()].flatMap((names) => [...names]));
}

/** Compare with the shared base and reject concurrent remote writes. */
async function syncCloud(name: string | null): Promise<SyncResult> {
  const remoteProvider = createCloudProvider();
  const remote = await remoteProvider.read();
  const local = await readLocalSyncFiles();

  const plan = await planSync(
    local,
    remote,
    settings.baseline,
    getProtectedNames(),
    name,
  );

  await remoteProvider.write(plan.push, remote);

  const changes = await applySyncPulls(
    local,
    plan,
    settings.baseline,
    getProtectedNames,
    (change) => emitFiles([change]),
  );

  settings.baseline = plan.acknowledged;

  return {
    conflicts: plan.conflicts,
    pushed: plan.push.length,
    pulled: changes.length,
  };
}

function finishSync(result: SyncResult) {
  settings.lastSyncedAt = new Date().toISOString();
  saveSyncSettings(settings);
  emitResult(result);

  return result;
}

/** Rejects names that cloud sync must not read or write. */
function assertSavedFileName(name: string) {
  if (!isSavedFileName(name)) {
    throw new Error("Only saved markdown and drawings can be synced.");
  }
}

/** Syncs every saved file, or pushes one when `name` is set. */
export function syncFiles(name: string | null, isBackground = false) {
  return runSyncOperation(async () => {
    if (name !== null) {
      assertSavedFileName(name);
    }

    return finishSync(await syncCloud(name));
  }, isBackground);
}

/** Overwrites the remote copy with the saved file. */
export function forceSyncFile(name: string) {
  return runSyncOperation(async (): Promise<SyncResult> => {
    assertSavedFileName(name);

    const local = (await readLocalSyncFiles()).get(name);

    if (!local) {
      throw new Error(`The saved file "${name}" no longer exists.`);
    }

    await createCloudProvider().forceWrite(
      name,
      local.content,
      local.modifiedAt,
    );
    Object.defineProperty(settings.baseline, name, {
      value: await contentHash(local.content),
      enumerable: true,
      configurable: true,
      writable: true,
    });

    return finishSync({ conflicts: [], pushed: 1, pulled: 0 });
  });
}

/** Signs in to `selected` and stores its destination; sign-in opens a pop-up. */
export async function connectSync(selected: SyncProvider) {
  await runSyncOperation(async () => {
    if (!Object.hasOwn(SYNC_PROVIDERS, selected)) {
      throw new Error("Unknown sync provider.");
    }

    const next: SyncSettings = createEmptySettings();
    next.provider = selected;
    authorization = new AbortController();

    try {
      const tokens = await signIn(
        selected,
        selected === "google-drive"
          ? publicCredentials.googleClientId
          : publicCredentials.dropboxAppKey,
        authorization.signal,
      );

      next.tokens = tokens;

      if (selected === "google-drive") {
        const api = createGoogleDriveApi(async () => tokens.accessToken);
        next.folderId = await api.getOrCreateFolder();
        next.account = await api.getAccountEmail();
      } else {
        next.account = await createDropboxApi(
          async () => tokens.accessToken,
        ).connect();
      }

      authorization.signal.throwIfAborted();
    } finally {
      authorization = null;
    }

    // Keep comparison history when the same destination reconnects.
    if (
      settings.provider === next.provider &&
      settings.account === next.account &&
      settings.folderId === next.folderId
    ) {
      next.baseline = settings.baseline;
      next.lastSyncedAt = settings.lastSyncedAt;
    }

    saveSyncSettings(next);
    settings = next;
    needsSignIn = false;
  });

  return getSyncStatus();
}

export async function disconnectSync() {
  await runSyncOperation(async () => {
    const next = createEmptySettings();
    saveSyncSettings(next);
    settings = next;
    needsSignIn = false;
  });

  return getSyncStatus();
}

export function cancelSyncSignIn() {
  authorization?.abort();
}

/** Names of saved files whose open buffers have pending edits in this tab. */
export function protectSyncFiles(names: string[]) {
  protectedByTab.set(tabId, new Set(names));
  channel.postMessage({ type: "protected", tabId, names } satisfies TabMessage);
}

function subscribe<T>(listeners: Set<T>, listener: T) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function onSyncStatus(listener: (status: SyncStatus) => void) {
  return subscribe(statusListeners, listener);
}

export function onSyncResult(listener: (result: SyncResult) => void) {
  return subscribe(resultListeners, listener);
}

export function onSyncedFiles(listener: (changes: SyncedFileChange[]) => void) {
  return subscribe(filesListeners, listener);
}

// Background sync runs while a tab is open and skips when another tab is syncing.
function syncInBackground() {
  if (settings.provider && !needsSignIn && !isBusy) {
    void syncFiles(null, true).catch(() => undefined);
  }
}

let hasStartupSynced = false;

/** Starts the one sync that runs when the tab opens; later calls do nothing. */
export function startupSync() {
  if (!hasStartupSynced) {
    hasStartupSynced = true;
    syncInBackground();
  }
}

setInterval(syncInBackground, SYNC_INTERVAL_MS);
