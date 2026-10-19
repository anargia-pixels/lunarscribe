import { toast } from "@lunarscribe/components/ui/toast";
import { useEffect } from "react";

import type { WatchedFile } from "@/lib/editor-files";
import { useBufferStore } from "@/stores/buffer-store";

/** The files behind open buffers, in a form main can resolve. */
function getWatchedFiles(): WatchedFile[] {
  return useBufferStore.getState().buffers.flatMap((buffer): WatchedFile[] => {
    if (buffer.externalPath) {
      return [{ kind: "external", path: buffer.externalPath }];
    }

    return buffer.fileName ? [{ kind: "saved", name: buffer.fileName }] : [];
  });
}

/** Reloads open buffers when another program, such as an agent, writes their files. */
export function useFileWatcher() {
  useEffect(() => {
    let watchedKey = "";

    const watch = () => {
      const files = getWatchedFiles();
      const key = JSON.stringify(files);

      if (key !== watchedKey) {
        watchedKey = key;
        window.lunarscribe.watchFiles(files);
      }
    };

    watch();
    const unsubscribeBuffers = useBufferStore.subscribe(watch);

    const unsubscribeChanges = window.lunarscribe.onWatchedFileChanged(
      (change) => {
        if (useBufferStore.getState().applyWatchedFile(change)) {
          return;
        }

        toast.add({
          type: "error",
          title: "File changed outside Lunarscribe",
          description: `${change.kind === "saved" ? change.name : change.path} changed while this buffer had unsaved edits. Your edits were kept; compare them with the file before saving.`,
          timeout: 0,
        });
      },
    );

    return () => {
      unsubscribeBuffers();
      unsubscribeChanges();
      window.lunarscribe.watchFiles([]);
    };
  }, []);
}
