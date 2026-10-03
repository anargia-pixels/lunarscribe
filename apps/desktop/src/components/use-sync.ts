import { toast } from "@lunarscribe/components/ui/toast";
import { useEffect } from "react";

import { reportFileError } from "@/lib/file-feedback";
import type { SyncStatus } from "@/lib/sync";
import { stemOf, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

function reportConflicts(names: string[]) {
  if (names.length) {
    toast.add({
      type: "warning",
      title: "Sync needs your attention",
      description: `Sync left these paths unchanged: ${names.join(", ")}. Review the local and remote copies before retrying sync.`,
      timeout: 0,
    });
  }
}

/** Connects background notifications and protects buffers with pending edits. */
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

      window.lunarscribe.protectSyncFiles(names);
    };

    protect();
    const unsubscribeBuffers = useBufferStore.subscribe(protect);

    const receiveStatus = (status: SyncStatus) => {
      useSyncStore.setState(status);

      if (status.error && !status.busy) {
        toast.add({
          type: "error",
          title: status.needsSignIn ? "Sign-in required" : "Sync failed",
          description: status.error,
        });
      }
    };

    let hasReceivedStatus = false;

    const unsubscribeStatus = window.lunarscribe.onSyncStatus((status) => {
      hasReceivedStatus = true;
      receiveStatus(status);
    });

    const unsubscribeResult = window.lunarscribe.onSyncResult((result) =>
      reportConflicts(result.conflicts),
    );

    const unsubscribeFiles = window.lunarscribe.onSyncedFiles((changes) => {
      reportConflicts(useBufferStore.getState().applySyncedFiles(changes));
    });

    let isActive = true;
    void window.lunarscribe
      .getSyncStatus()
      .then((status) => {
        if (isActive && !hasReceivedStatus) {
          receiveStatus(status);
        }
      })
      .catch((cause) => {
        if (isActive) {
          reportFileError(
            cause,
            "Unable to load sync status",
            "Try reopening Lunarscribe.",
          );
        }
      });

    return () => {
      isActive = false;
      unsubscribeBuffers();
      unsubscribeStatus();
      unsubscribeResult();
      unsubscribeFiles();
    };
  }, []);
}
