import { refreshTokens } from "@lunarscribe/utils/sync/oauth";
import type { LocalSyncStore } from "@lunarscribe/utils/sync/plan";
import {
  createCloudBackend,
  createSyncService,
  SyncLockHeld,
} from "@lunarscribe/utils/sync/service";
import {
  createEmptySettings,
  parseSyncSettings,
} from "@lunarscribe/utils/sync/settings";
import type { SyncSettingsStore } from "@lunarscribe/utils/sync/settings";
import { isCloudSyncProvider } from "@lunarscribe/utils/sync/types";
import type {
  CloudSyncProvider,
  SyncedFileChange,
  SyncResult,
} from "@lunarscribe/utils/sync/types";

import type { SavedFileRecord, SavedImageRecord } from "@/lib/browser-database";
import { applySyncedFile, readSyncedFiles } from "@/lib/saved-files";
import { signIn } from "@/lib/sync/oauth";
import publicCredentials from "@/lib/sync/public-creds.json";

/**
 * Browser sync. Each tab runs its own service; a Web Lock lets one tab sync at a time,
 * and a broadcast channel shares results, pulled files and protected buffers.
 */

// Tabs
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

const SYNC_LOCK = "lunarscribe-sync";

/** localStorage key; every tab reads it, so sync history stays shared. */
const SYNC_SETTINGS_KEY = "lunarscribe-sync-settings";

type TabMessage =
  | { type: "result"; result: SyncResult }
  | { type: "files"; changes: SyncedFileChange[] }
  | { type: "protected"; tabId: string; names: string[] };

const tabId = crypto.randomUUID();

const channel = new BroadcastChannel("lunarscribe-sync");

const protectedByTab = new Map<string, Set<string>>();

/** Results and pulled files from other tabs. */
const remoteResultListeners = new Set<(result: SyncResult) => void>();

const remoteFilesListeners = new Set<(changes: SyncedFileChange[]) => void>();

// Storage
const settingsStore: SyncSettingsStore = {
  async load() {
    const serialized = localStorage.getItem(SYNC_SETTINGS_KEY);

    return serialized === null
      ? createEmptySettings()
      : parseSyncSettings(serialized, isCloudSyncProvider);
  },
  async save(settings) {
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(settings));
  },
};

const localSyncStore: LocalSyncStore<SavedFileRecord | SavedImageRecord> = {
  async read(name) {
    return new Map(
      (await readSyncedFiles(name)).map((record) => [record.name, record]),
    );
  },
  apply: (change, before) =>
    applySyncedFile(
      change.name,
      before,
      change.content,
      change.content === null ? 0 : change.modifiedAt,
    ),
};

// Service
function cloudBackend(provider: CloudSyncProvider) {
  const clientId =
    provider === "google-drive"
      ? publicCredentials.googleClientId
      : publicCredentials.dropboxAppKey;

  return createCloudBackend(
    provider,
    {
      signIn: (signal) => signIn(provider, clientId, signal),
      refresh: (tokens) => refreshTokens(provider, tokens),
    },
    localSyncStore,
  );
}

const service = createSyncService<CloudSyncProvider>({
  backends: {
    "google-drive": cloudBackend("google-drive"),
    dropbox: cloudBackend("dropbox"),
  },
  settings: settingsStore,
  getProtectedNames: () =>
    new Set([...protectedByTab.values()].flatMap((names) => [...names])),
  lock: (operation) =>
    navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) {
        throw new SyncLockHeld(
          "Another Lunarscribe tab is syncing. Try again when it finishes.",
        );
      }

      return operation();
    }),
});

service.onResult((result) =>
  channel.postMessage({ type: "result", result } satisfies TabMessage),
);

service.onFiles((changes) =>
  channel.postMessage({ type: "files", changes } satisfies TabMessage),
);

channel.addEventListener("message", (event: MessageEvent<TabMessage>) => {
  const message = event.data;

  if (message.type === "result") {
    for (const listener of remoteResultListeners) listener(message.result);
  } else if (message.type === "files") {
    for (const listener of remoteFilesListeners) listener(message.changes);
  } else {
    protectedByTab.set(message.tabId, new Set(message.names));
  }
});

// Another tab connected, disconnected, or finished a sync.
window.addEventListener("storage", (event) => {
  if (event.key === SYNC_SETTINGS_KEY && !service.getStatus().isBusy) {
    void service.reload();
  }
});

window.addEventListener("pagehide", () => {
  service.cancelSignIn();
  channel.postMessage({
    type: "protected",
    tabId,
    names: [],
  } satisfies TabMessage);
});

// Public API, matching the desktop preload bridge
export const getSyncStatus = service.getStatus;

export const syncFiles = (name: string | null) => service.sync(name);

export const forceSyncFile = service.forcePush;

/** Other tabs get the change; this tab's buffers apply the returned change themselves. */
export async function forcePullFile(name: string) {
  const change = await service.forcePull(name);

  channel.postMessage({
    type: "files",
    changes: [change],
  } satisfies TabMessage);

  return change;
}

export const connectSync = service.connect;

export const disconnectSync = service.disconnect;

export const cancelSyncSignIn = service.cancelSignIn;

/** Names of saved files whose open buffers have pending edits in this tab. */
export function protectSyncFiles(names: string[]) {
  protectedByTab.set(tabId, new Set(names));
  channel.postMessage({ type: "protected", tabId, names } satisfies TabMessage);
}

export const onSyncStatus = service.onStatus;

/** Results from this tab and every other tab. */
export function onSyncResult(listener: (result: SyncResult) => void) {
  remoteResultListeners.add(listener);
  const unsubscribe = service.onResult(listener);

  return () => {
    remoteResultListeners.delete(listener);
    unsubscribe();
  };
}

/** Pulled files from this tab and every other tab. */
export function onSyncedFiles(listener: (changes: SyncedFileChange[]) => void) {
  remoteFilesListeners.add(listener);
  const unsubscribe = service.onFiles(listener);

  return () => {
    remoteFilesListeners.delete(listener);
    unsubscribe();
  };
}

// Background sync runs while a tab is open and skips when another tab is syncing.
let hasStartupSynced = false;

/** Starts the one sync that runs when the tab opens; later calls do nothing. */
export function startupSync() {
  if (!hasStartupSynced) {
    hasStartupSynced = true;
    void service.syncInBackground();
  }
}

setInterval(service.syncInBackground, SYNC_INTERVAL_MS);
