import { toast } from "@lunarscribe/components/ui/toast";
import { createElement, useEffect } from "react";

import { reportFileError } from "@/lib/file-feedback";
import { useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

/** Report a shortcut push without repeating background error toasts. */
async function pushSavedFile(fileName: string) {
  try {
    const syncResult = await window.lunarscribe.syncFiles(fileName);

    if (!syncResult.conflicts.length) {
      toast.add({
        type: "success",
        title: "File synced",
        description: createElement("code", null, fileName),
      });
    }
  } catch (cause) {
    if (!useSyncStore.getState().error) {
      reportFileError(
        cause,
        "File saved; sync pending",
        "Try syncing again after the current sync finishes.",
      );
    }
  }
}

/** Capture the save shortcut before the editor or Electron processes it. */
export function useSaveShortcut() {
  useEffect(() => {
    const handleSaveShortcut = async (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "s" ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing
      ) {
        return;
      }

      // Repeated keys must also suppress Electron's default save action.
      event.preventDefault();
      event.stopPropagation();

      if (event.repeat) {
        return;
      }

      const id = useBufferStore.getState().activeId;

      try {
        const fileName = await useBufferStore.getState().saveActiveBuffer();

        const buffer = useBufferStore
          .getState()
          .buffers.find((candidate) => candidate.id === id);

        toast.add({
          type: "success",
          title: "File saved",
          description: createElement("code", null, fileName),
        });

        if (buffer?.fileName && useSyncStore.getState().provider) {
          await pushSavedFile(buffer.fileName);
        }
      } catch (cause) {
        reportFileError(
          cause,
          "Unable to save file",
          "The file could not be saved.",
        );
      }
    };

    window.addEventListener("keydown", handleSaveShortcut, true);

    return () =>
      window.removeEventListener("keydown", handleSaveShortcut, true);
  }, []);
}
