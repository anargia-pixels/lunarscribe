import { Debouncer } from "@tanstack/pacer/debouncer";
import type { StoreApi } from "zustand";

import {
  BUFFER_EXTENSIONS,
  getFileExtension,
  stemOf,
} from "@/lib/editor-files";
import { reportFileError } from "@/lib/file-feedback";
import { createOperationQueue } from "@/lib/operation-queue";
import type { BufferStore } from "@/stores/buffer-store";

/** Owns disk-write ordering and save timers; the store retains buffer and selection state. */
export function createBufferFileWrites(store: StoreApi<BufferStore>) {
  const queueOperation = createOperationQueue();

  type SaveResult =
    | { status: "saved"; fileName: string }
    | { status: "closed" | "empty" };

  type SaveMode = "automatic" | "manual";

  /** Buffer identity remains stable after either kind of rename. */
  function queueBufferWrite<T>(id: string, operation: () => Promise<T>) {
    return queueOperation(id, operation);
  }

  /** Saves share the same buffer queue as sidebar operations. Never enqueue again inside that queue. */
  function saveBuffer(id: string) {
    return queueBufferWrite(id, () => writeBuffer(id, "automatic"));
  }

  function saveBufferNow(id: string) {
    saveDebouncers.get(id)?.cancel();

    return queueBufferWrite(id, () => writeBuffer(id, "manual"));
  }

  /** Writes the latest buffer and records its file name; a manual save also creates an empty file. */
  async function writeBuffer(id: string, mode: SaveMode): Promise<SaveResult> {
    const buffer = store
      .getState()
      .buffers.find((candidate) => candidate.id === id);

    if (!buffer) {
      return { status: "closed" };
    }

    if (buffer.externalPath) {
      await window.lunarscribe.saveExternalFile(
        buffer.externalPath,
        buffer.content,
      );

      return {
        status: "saved",
        fileName:
          store
            .getState()
            .externalFiles.find((file) => file.path === buffer.externalPath)
            ?.name ?? buffer.title,
      };
    }

    // Autosave waits for a new buffer to have content; manual saves may create empty files.
    if (
      mode === "automatic" &&
      buffer.fileName === null &&
      !buffer.content.trim()
    ) {
      return { status: "empty" };
    }

    const fileName = await window.lunarscribe.saveFile(
      buffer.fileName,
      buffer.title,
      getFileExtension(buffer.fileName ?? "") ?? BUFFER_EXTENSIONS[buffer.kind],
      buffer.content,
    );

    store.setState((state) => ({
      buffers: state.buffers.map((candidate) => {
        if (candidate.id !== id) {
          return candidate;
        }

        // Keep a newer header edit; otherwise adopt a collision suffix returned by the save.
        const title =
          candidate.title === buffer.title ? stemOf(fileName) : candidate.title;

        return { ...candidate, fileName, title };
      }),
    }));

    return { status: "saved", fileName };
  }

  const saveDebouncers = new Map<string, Debouncer<() => undefined>>();

  /** Restarts the buffer's 2s save timer. */
  function scheduleSave(id: string) {
    const debouncer =
      saveDebouncers.get(id) ??
      new Debouncer(
        () => {
          void saveBuffer(id).catch((error) => {
            reportFileError(
              error,
              "Unable to save buffer",
              "Changes could not be saved.",
            );
          });
        },
        { wait: 2000 },
      );

    saveDebouncers.set(id, debouncer);
    debouncer.maybeExecute();
  }

  // Closing the window must not drop edits still waiting on their timer.
  window.addEventListener("beforeunload", () => {
    for (const debouncer of saveDebouncers.values()) {
      debouncer.flush();
    }
  });

  function discardSaveTimer(id: string) {
    saveDebouncers.get(id)?.cancel();
    saveDebouncers.delete(id);
  }

  return {
    queueBufferWrite,
    writeBuffer,
    saveBufferNow,
    scheduleSave,
    discardSaveTimer,
  };
}
