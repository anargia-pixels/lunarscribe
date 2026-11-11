import { stemOf } from "@lunarscribe/utils/file-kinds";
import type { SyncConflict, SyncStatus } from "@lunarscribe/utils/sync/types";
import { useEffect } from "react";

import {
  protectSyncFiles,
  startBackgroundSyncOnce,
  syncService,
} from "@/lib/sync/sync-service";
import { useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

/** Keep conflicts visible until the user dismisses them. */
function reportConflicts(conflicts: SyncConflict[]) {
  if (conflicts.length) {
    useSyncStore.setState({
      notice: {
        title: "Sync conflict",
        description: "Both copies of these files were preserved.",
        conflicts,
      },
    });
  }
}

/** Connects background sync to the buffers and protects buffers with pending edits. */
export function useSync() {
  useEffect(() => {
    const protect = () => {
      const names: string[] = [];

      for (const buffer of useBufferStore.getState().buffers) {
        if (
          buffer.fileName &&
          (buffer.content !== buffer.savedContent ||
            buffer.title !== stemOf(buffer.fileName))
        ) {
          names.push(buffer.fileName);
        }
      }

      protectSyncFiles(names);
    };

    protect();
    const unsubscribeBuffers = useBufferStore.subscribe(protect);

    const receiveStatus = (status: SyncStatus) => {
      useSyncStore.setState(status);

      if (status.error && !status.isBusy) {
        useSyncStore.setState({
          notice: {
            title: status.isSignInRequired ? "Sign-in required" : "Sync failed",
            description: status.error,
            conflicts: [],
          },
        });
      }
    };

    const unsubscribeStatus = syncService.onStatus(receiveStatus);

    const unsubscribeResult = syncService.onResult((result) =>
      reportConflicts(result.conflicts),
    );

    const unsubscribeFiles = syncService.onFiles((changes) => {
      const conflicts = useBufferStore.getState().applySyncedFiles(changes);

      reportConflicts(
        conflicts.map((name) => ({
          name,
          reason:
            "This buffer has pending edits. They were preserved; compare them with the saved file before continuing.",
        })),
      );
    });

    receiveStatus(syncService.getStatus());
    // Downloads from this sync reach the buffers through the listeners above.
    startBackgroundSyncOnce();

    return () => {
      unsubscribeBuffers();
      unsubscribeStatus();
      unsubscribeResult();
      unsubscribeFiles();
    };
  }, []);
}
