import { toast } from "@lunarscribe/components/ui/toast";
import { useEffect } from "react";

import { reportFileError } from "@/lib/file-feedback";
import { useBufferStore } from "@/stores/buffer-store";

/** Captures save before an editor or Electron can treat it as export or browser save. */
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

      try {
        const fileName = await useBufferStore.getState().saveActiveBuffer();
        toast.add({
          type: "success",
          title: "File saved",
          description: fileName,
        });
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
