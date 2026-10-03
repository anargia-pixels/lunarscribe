import { create } from "zustand";

import type { SyncStatus } from "@/lib/sync";

export const useSyncStore = create<SyncStatus>(() => ({
  provider: null,
  account: null,
  busy: false,
  lastSyncedAt: null,
  error: null,
  googleConfigured: false,
  dropboxConfigured: false,
  needsSignIn: false,
}));
