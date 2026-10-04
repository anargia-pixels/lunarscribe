import { toast } from "@lunarscribe/components/ui/toast";
import { createElement, useEffect } from "react";

import { formatFileMessage } from "@/lib/file-message";
import {
  getSyncStatus,
  onSyncedFiles,
  onSyncResult,
  onSyncStatus,
  protectSyncFiles,
} from "@/lib/sync/sync-service";
import type { SyncConflict, SyncStatus } from "@/lib/sync/sync-types";
import { stemOf, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

/** Keep conflicts visible until the user dismisses the toast. */
function reportConflicts(conflicts: SyncConflict[]) {
  if (conflicts.length) {
    toast.add({
      type: "error",
      title: "Sync conflict",
      description: createElement(
        "div",
        { className: "flex flex-col gap-2" },
        ...conflicts.map(({ name, reason }) =>
          createElement(
            "p",
            { key: name },
            createElement("code", null, name),
            ": ",
            reason,
          ),
        ),
      ),
      timeout: 0,
    });
  }
}

/** Connects background notifications and protects buffers with pending edits. */
export function useSync() {
  useEffect(() => {
    let successTimer: ReturnType<typeof setTimeout> | undefined;
    let hasPendingEdits = false;
    let hasBufferConflicts = false;

    const clearSuccess = () => {
      clearTimeout(successTimer);
      useSyncStore.setState({ hasSyncedSuccessfully: false });
    };

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

      hasPendingEdits = names.length > 0;

      if (hasPendingEdits) {
        clearSuccess();
      }

      protectSyncFiles(names);
    };

    protect();
    const unsubscribeBuffers = useBufferStore.subscribe(protect);

    const receiveStatus = (status: SyncStatus) => {
      useSyncStore.setState(status);

      if (
        status.busy ||
        status.error ||
        status.needsSignIn ||
        !status.provider
      ) {
        clearSuccess();
      }

      if (status.busy) {
        hasBufferConflicts = false;
      }

      if (status.error && !status.busy) {
        toast.add({
          type: "error",
          title: status.needsSignIn ? "Sign-in required" : "Sync failed",
          description: formatFileMessage(status.error),
        });
      }
    };

    let hasReceivedStatus = false;

    const unsubscribeStatus = onSyncStatus((status) => {
      hasReceivedStatus = true;
      receiveStatus(status);
    });

    const unsubscribeResult = onSyncResult((result) => {
      reportConflicts(result.conflicts);
      clearSuccess();

      if (!result.conflicts.length && !hasPendingEdits && !hasBufferConflicts) {
        useSyncStore.setState({ hasSyncedSuccessfully: true });
        successTimer = setTimeout(clearSuccess, 3000);
      }
    });

    const unsubscribeFiles = onSyncedFiles((changes) => {
      const conflicts = useBufferStore.getState().applySyncedFiles(changes);

      if (conflicts.length) {
        hasBufferConflicts = true;
        clearSuccess();
      }

      reportConflicts(
        conflicts.map((name) => ({
          name,
          reason:
            "This buffer has pending edits. They were preserved; compare them with the saved file before continuing.",
        })),
      );
    });

    if (!hasReceivedStatus) {
      receiveStatus(getSyncStatus());
    }

    return () => {
      clearSuccess();
      unsubscribeBuffers();
      unsubscribeStatus();
      unsubscribeResult();
      unsubscribeFiles();
    };
  }, []);
}
