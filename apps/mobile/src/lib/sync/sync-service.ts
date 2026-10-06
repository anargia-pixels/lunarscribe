import { errorMessage } from "@lunarscribe/utils/error-message";
import type { FileSyncProvider } from "@lunarscribe/utils/sync/types";
import { SyncSignInRequired } from "@lunarscribe/utils/sync/types";
import { AppState } from "react-native";

import { createDropboxApi } from "@/lib/sync/dropbox";
import {
  applySyncPulls,
  contentHash,
  currentPulledTimes,
  isSavedFileName,
  planSync,
  readLocalSyncFiles,
} from "@/lib/sync/files";
import { createGoogleDriveApi } from "@/lib/sync/google-drive";
import { assertSignInActive, refreshTokens, signIn } from "@/lib/sync/oauth";
import {
  createEmptySettings,
  loadSyncSettings,
  saveSyncSettings,
} from "@/lib/sync/settings";
import type { SyncSettings } from "@/lib/sync/settings";
import type {
  SyncedFileChange,
  SyncProvider,
  SyncResult,
  SyncStatus,
} from "@/lib/sync/sync-types";

/**
 * Mobile counterpart of the desktop sync service. The app is one process, so a busy
 * flag is the only lock. Sync runs on launch, every five minutes while the app is in
 * the foreground, and when the app returns to the foreground.
 */

// Module state
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

const statusListeners = new Set<(status: SyncStatus) => void>();

const resultListeners = new Set<(result: SyncResult) => void>();

const filesListeners = new Set<(changes: SyncedFileChange[]) => void>();

let settings = createEmptySettings();

let isBusy = false;

let error: string | null = null;

let isSignInRequired = false;

let authorization: AbortController | null = null;

let protectedNames = new Set<string>();

/** Reads the stored settings once at launch; operations wait for it. */
async function loadSettings() {
  try {
    settings = await loadSyncSettings();
    isSignInRequired = settings.provider !== null && settings.tokens === null;

    if (isSignInRequired) {
      error = "Sign-in is required. Open Settings and select Sign in again.";
    }
  } catch (cause) {
    error = errorMessage(cause, "Unable to load sync settings.");
  }
}

const settingsLoaded = loadSettings();

// Public API, matching the desktop preload bridge
export function getSyncStatus(): SyncStatus {
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

function emitStatus() {
  emit(statusListeners, getSyncStatus());
}

// Access tokens
/** Access tokens live in memory; refresh one when it is missing or about to expire. */
async function getAccessToken(provider: SyncProvider) {
  if (!settings.tokens || settings.provider !== provider) {
    throw new SyncSignInRequired("Reconnect your sync account.");
  }

  let tokens = settings.tokens;

  if (tokens.expiresAt <= Date.now() + 60_000) {
    tokens = await refreshTokens(provider, tokens);
    settings.tokens = tokens;
    await saveSyncSettings(settings);
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
/** Allow one sync operation at a time and report its status. */
async function runSyncOperation<T>(operation: () => Promise<T>) {
  if (isBusy) {
    throw new Error(
      "A sync operation is already running. Try again when it finishes.",
    );
  }

  isBusy = true;
  emitStatus();

  try {
    // Settings only change in this process, so the launch load stays current.
    await settingsLoaded;
    error = null;

    return await operation();
  } catch (cause) {
    if (cause instanceof SyncSignInRequired) {
      isSignInRequired = true;
    }

    error = errorMessage(cause, "Sync failed. Your local writing is safe.");
    throw new Error(error);
  } finally {
    isBusy = false;
    emitStatus();
  }
}

/** Compare with the shared base and reject concurrent remote writes. */
async function syncCloud(name: string | null): Promise<SyncResult> {
  const remoteProvider = createCloudProvider();
  const remote = await remoteProvider.read(name);
  const local = await readLocalSyncFiles(settings.pulledTimes);

  const plan = await planSync(
    local,
    remote,
    settings.baseline,
    protectedNames,
    name,
  );

  await remoteProvider.write(plan.push, remote);

  const pulledTimes = currentPulledTimes(local, settings.pulledTimes);

  const changes = await applySyncPulls(
    local,
    plan,
    settings.baseline,
    pulledTimes,
    () => protectedNames,
    (change) => emit(filesListeners, [change]),
  );

  settings.baseline = plan.acknowledged;
  settings.pulledTimes = pulledTimes;

  return {
    conflicts: plan.conflicts,
    pushed: plan.push.length,
    pulled: changes.length,
  };
}

async function finishSync(result: SyncResult) {
  settings.lastSyncedAt = new Date().toISOString();
  await saveSyncSettings(settings);
  emit(resultListeners, result);

  return result;
}

/** Rejects names that cloud sync must not read or write. */
function assertSavedFileName(name: string) {
  if (!isSavedFileName(name)) {
    throw new Error("Only saved markdown and drawings can be synced.");
  }
}

/** Syncs every saved file, or pushes one when `name` is set. */
export function syncFiles(name: string | null) {
  return runSyncOperation(async () => {
    if (name !== null) {
      assertSavedFileName(name);
    }

    return finishSync(await syncCloud(name));
  });
}

/** Overwrites the remote copy with the saved file. */
export function forceSyncFile(name: string) {
  return runSyncOperation(async (): Promise<SyncResult> => {
    assertSavedFileName(name);

    const local = (await readLocalSyncFiles(settings.pulledTimes)).get(name);

    if (!local) {
      throw new Error(`The saved file "${name}" no longer exists.`);
    }

    await createCloudProvider().forceWrite(
      name,
      local.content,
      local.modifiedAt,
    );
    settings.baseline[name] = await contentHash(local.content);

    return finishSync({ conflicts: [], pushed: 1, pulled: 0 });
  });
}

/** Signs in to `selected` in the system browser and stores its destination. */
export async function connectSync(selected: SyncProvider) {
  await runSyncOperation(async () => {
    const next: SyncSettings = createEmptySettings();
    next.provider = selected;
    authorization = new AbortController();

    try {
      const tokens = await signIn(selected, authorization.signal);
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

      assertSignInActive(authorization.signal);
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
      next.pulledTimes = settings.pulledTimes;
      next.lastSyncedAt = settings.lastSyncedAt;
    }

    await saveSyncSettings(next);
    settings = next;
    isSignInRequired = false;
  });

  return getSyncStatus();
}

export async function disconnectSync() {
  await runSyncOperation(async () => {
    const next = createEmptySettings();
    await saveSyncSettings(next);
    settings = next;
    isSignInRequired = false;
  });

  return getSyncStatus();
}

export function cancelSyncSignIn() {
  authorization?.abort();
}

/** Names of saved files whose open buffers have pending edits. */
export function protectSyncFiles(names: string[]) {
  protectedNames = new Set(names);
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

// Background sync
function syncInBackground() {
  if (settings.provider && !isSignInRequired && !isBusy) {
    void syncFiles(null).catch(() => undefined);
  }
}

let interval: ReturnType<typeof setInterval> | null = null;

/** Syncs now and every five minutes; pauses while the app is in the background. */
function startBackgroundSync() {
  if (interval === null) {
    syncInBackground();
    interval = setInterval(syncInBackground, SYNC_INTERVAL_MS);
  }
}

let hasStarted = false;

/** Starts background sync once settings load; later calls do nothing. */
export function startBackgroundSyncOnce() {
  if (hasStarted) {
    return;
  }

  hasStarted = true;

  void settingsLoaded.then(() => {
    emitStatus();

    if (AppState.currentState === "active") {
      startBackgroundSync();
    }

    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        startBackgroundSync();
      } else if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    });
  });
}
