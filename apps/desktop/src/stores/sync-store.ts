import { create } from "zustand";

import type { SyncStatus } from "@/lib/sync";

type SyncState = SyncStatus & {
  hasSyncedSuccessfully: boolean;
};

export const useSyncStore = create<SyncState>(() => ({
  provider: null,
  account: null,
  busy: false,
  lastSyncedAt: null,
  error: null,
  needsSignIn: false,
  hasSyncedSuccessfully: false,
}));
