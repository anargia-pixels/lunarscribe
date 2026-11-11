import type { SyncStatus } from "@lunarscribe/utils/sync/types";
import { create } from "zustand";

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
