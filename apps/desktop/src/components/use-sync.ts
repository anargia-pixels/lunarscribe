import { toast } from "@lunarscribe/components/ui/toast";
import { createElement, useEffect } from "react";

import { reportFileError } from "@/lib/file-feedback";
import { formatFileMessage } from "@/lib/file-message";
import type { SyncConflict, SyncStatus } from "@/lib/sync";
import { stemOf, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

/** Keep conflicts visible until the user dismisses the toast. */
function reportConflicts(conflicts: SyncConflict[]) {
  if (conflicts.length) {
    toast.add({
      type: "warning",
      title: "Sync needs your attention",
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
          description: formatFileMessage(status.error),
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
      reportConflicts(
        useBufferStore
          .getState()
          .applySyncedFiles(changes)
          .map((name) => ({
            name,
            reason:
              "This buffer has pending edits. They were preserved; compare them with the saved file before continuing.",
          })),
      );
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
