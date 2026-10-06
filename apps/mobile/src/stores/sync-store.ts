import { create } from "zustand";

import type { SyncConflict, SyncStatus } from "@/lib/sync/sync-types";

/** A sync failure or conflicts, shown on the files screen until dismissed. */
export type SyncNotice = {
  title: string;
  description: string;
  conflicts: SyncConflict[];
};

type SyncState = SyncStatus & {
  notice: SyncNotice | null;
  clearNotice: () => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  provider: null,
  account: null,
  isBusy: false,
  lastSyncedAt: null,
  error: null,
  isSignInRequired: false,
  notice: null,
  clearNotice: () => set({ notice: null }),
}));
