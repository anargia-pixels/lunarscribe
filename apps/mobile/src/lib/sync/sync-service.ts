import { refreshTokens } from "@lunarscribe/utils/sync/oauth";
import {
  createCloudBackend,
  createSyncService,
} from "@lunarscribe/utils/sync/service";
import type { CloudSyncProvider } from "@lunarscribe/utils/sync/types";
import { AppState } from "react-native";

import { signIn } from "@/lib/sync/oauth";
import { contentHash, localSyncStore, settingsStore } from "@/lib/sync/storage";

// Service
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Saved files whose open buffers have pending edits; the app is one process. */
let protectedNames = new Set<string>();

function cloudBackend(provider: CloudSyncProvider) {
  return createCloudBackend(
    provider,
    {
      signIn: (signal) => signIn(provider, signal),
      refresh: (tokens) => refreshTokens(provider, tokens),
    },
    localSyncStore,
    contentHash,
  );
}

/** Mobile sync over the documents folder; one process, so it needs no lock. */
export const syncService = createSyncService<CloudSyncProvider>({
  backends: {
    "google-drive": cloudBackend("google-drive"),
    dropbox: cloudBackend("dropbox"),
  },
  settings: settingsStore,
  getProtectedNames: () => protectedNames,
});

export function protectSyncFiles(names: string[]) {
  protectedNames = new Set(names);
}

// Background sync
let interval: ReturnType<typeof setInterval> | null = null;

/** Sync now and every five minutes while the app is in the foreground. */
function startBackgroundSync() {
  if (interval === null) {
    void syncService.syncInBackground();
    interval = setInterval(syncService.syncInBackground, SYNC_INTERVAL_MS);
  }
}

let hasStarted = false;

/** Start background sync; later calls do nothing. */
export function startBackgroundSyncOnce() {
  if (hasStarted) {
    return;
  }

  hasStarted = true;

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
}
