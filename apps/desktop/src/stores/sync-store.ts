import { create } from "zustand";

import type { SyncStatus } from "@/lib/sync";

type SyncState = SyncStatus & {
  hasSyncedSuccessfully: boolean;
};

export const useSyncStore = create<SyncState>(() => ({
  provider: null,
  account: null,
  isBusy: false,
  lastSyncedAt: null,
  error: null,
  isSignInRequired: false,
  hasSyncedSuccessfully: false,
}));
