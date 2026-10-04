import { Debouncer } from "@tanstack/pacer/debouncer";
import type { StoreApi } from "zustand";

import {
  BUFFER_EXTENSIONS,
  getFileExtension,
  stemOf,
} from "@/lib/editor-files";
import { saveExternalFile } from "@/lib/external-files";
import { reportFileError } from "@/lib/file-feedback";
import { createOperationQueue } from "@/lib/operation-queue";
import { saveFile } from "@/lib/saved-files";
import type { BufferStore } from "@/stores/buffer-store";

/** Owns storage-write ordering and save timers; the store retains buffer and selection state. */
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

    if (buffer.externalId) {
      await saveExternalFile(buffer.externalId, buffer.content);

      return {
        status: "saved",
        fileName:
          store
            .getState()
            .externalFiles.find((file) => file.id === buffer.externalId)
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

    const fileName = await saveFile(
      buffer.fileName,
      buffer.title,
      getFileExtension(buffer.fileName ?? "") ?? BUFFER_EXTENSIONS[buffer.kind],
      buffer.content,
      buffer.savedContent,
    );

    store.setState((state) => ({
      buffers: state.buffers.map((candidate) => {
        if (candidate.id !== id) {
          return candidate;
        }

        // Keep a newer header edit; otherwise adopt a collision suffix returned by the save.
        const title =
          candidate.title === buffer.title ? stemOf(fileName) : candidate.title;

        return { ...candidate, fileName, title, savedContent: buffer.content };
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

  // Hiding or closing the tab must not drop edits still waiting on their timer.
  function flushSaveTimers() {
    for (const debouncer of saveDebouncers.values()) {
      debouncer.flush();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushSaveTimers();
    }
  });
  window.addEventListener("pagehide", flushSaveTimers);

  // Browser storage writes are asynchronous, so ask before leaving with unsaved edits.
  window.addEventListener("beforeunload", (event) => {
    flushSaveTimers();

    const hasUnsavedEdits = store
      .getState()
      .buffers.some(
        (buffer) =>
          buffer.content !== buffer.savedContent &&
          (buffer.fileName !== null ||
            buffer.externalId !== null ||
            buffer.content.trim() !== ""),
      );

    if (hasUnsavedEdits) {
      event.preventDefault();
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
