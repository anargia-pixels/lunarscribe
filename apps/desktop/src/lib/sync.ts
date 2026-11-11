import { CLOUD_SYNC_PROVIDERS } from "@lunarscribe/utils/sync/types";
import type { SyncStatus as SharedSyncStatus } from "@lunarscribe/utils/sync/types";

/** The desktop app also syncs through a Git repository on GitHub. */
export const SYNC_PROVIDERS = {
  github: "GitHub",
  ...CLOUD_SYNC_PROVIDERS,
} as const;

export type SyncProvider = keyof typeof SYNC_PROVIDERS;

export function isSyncProvider(value: string): value is SyncProvider {
  return Object.hasOwn(SYNC_PROVIDERS, value);
}

export type SyncStatus = SharedSyncStatus<SyncProvider>;
