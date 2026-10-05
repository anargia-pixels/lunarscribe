import { errorMessage } from "@lunarscribe/utils/error-message";
import { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import { Debouncer } from "@tanstack/pacer/debouncer";
import { AppState } from "react-native";
import { create } from "zustand";

import * as documentsFolder from "@/lib/documents-folder";
import {
  BUFFER_EXTENSIONS,
  getFileExtension,
  kindOf,
  stemOf,
  toBufferTitle,
} from "@/lib/editor-files";
import type { EditorKind } from "@/lib/editor-types";
import { forceSyncFile } from "@/lib/sync/sync-service";
import type { SyncedFileChange } from "@/lib/sync/sync-types";

// Types
/** One open piece of writing; `content` is the source of truth its editor loads from and saves to. */
export type TextBuffer = {
  id: string;
  title: string;
  kind: EditorKind;
  /** Markdown, or the Excalidraw scene JSON for a drawing; empty for a new drawing. */
  content: string;
  /** Bumped when content is replaced from outside the editor, so the editor reloads it. */
  syncRevision: number;
  /** Saved file in the documents folder, or null until the first save. */
  fileName: string | null;
  /** Content as last saved or loaded, so sync can tell which buffers have pending edits. */
  savedContent: string | null;
};

type BufferStore = {
  buffers: TextBuffer[];
  activeId: string | null;
  /** Saved file names in the documents folder. */
  files: string[];
  /** The last failed file operation, shown until dismissed. */
  fileError: string | null;
  clearFileError: () => void;
  refreshFiles: () => void;
  setContent: (id: string, content: string) => void;
  createBuffer: (kind: EditorKind) => void;
  openFile: (name: string) => Promise<void>;
  /** Writes pending edits now instead of waiting for the save timer. */
  flushBuffer: (id: string) => Promise<void>;
  renameFile: (name: string, title: string) => Promise<void>;
  deleteFile: (name: string) => Promise<void>;
  /** Overwrites the remote copy with the saved file, after writing pending edits. */
  forceSyncFile: (name: string) => Promise<void>;
  /**
   * Reloads buffers whose files sync pulled. Returns the names it skipped because their
   * buffers have pending edits.
   */
  applySyncedFiles: (changes: SyncedFileChange[]) => string[];
};

// Save queue and timers
// Saves, renames and deletes of one buffer run in request order.
const queueBufferWrite = createOperationQueue();

const saveDebouncers = new Map<string, Debouncer<() => undefined>>();

let nextBufferId = 0;

/** Buffer IDs only live in memory, so a counter keeps them unique. */
function createBufferId() {
  nextBufferId += 1;

  return `buffer-${nextBufferId}`;
}

// Buffer helpers
function findBuffer(predicate: (buffer: TextBuffer) => boolean) {
  return useBufferStore.getState().buffers.find(predicate) ?? null;
}

/** Merges the fields `update` returns into the buffer with `id`. */
function updateBuffer(
  id: string,
  update: (buffer: TextBuffer) => Partial<TextBuffer>,
) {
  useBufferStore.setState((state) => ({
    buffers: state.buffers.map((buffer) =>
      buffer.id === id ? { ...buffer, ...update(buffer) } : buffer,
    ),
  }));
}

/** Adds a buffer and shows it in the editor. */
function openBuffer(fields: Omit<TextBuffer, "id" | "syncRevision">) {
  const id = createBufferId();

  useBufferStore.setState((state) => ({
    buffers: [...state.buffers, { ...fields, id, syncRevision: 0 }],
    activeId: id,
  }));
}

/** Removes a buffer and its save timer, without writing pending edits. */
function closeBuffer(id: string) {
  discardSaveTimer(id);
  useBufferStore.setState((state) => ({
    buffers: state.buffers.filter((buffer) => buffer.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  }));
}

function reportFileError(cause: unknown, fallback: string) {
  useBufferStore.setState({ fileError: errorMessage(cause, fallback) });
}

/** Writes the latest buffer and records its file name; an automatic save skips an empty new buffer. */
async function writeBuffer(id: string, mode: "automatic" | "manual") {
  const buffer = findBuffer((candidate) => candidate.id === id);

  if (!buffer) {
    return;
  }

  if (
    mode === "automatic" &&
    buffer.fileName === null &&
    !buffer.content.trim()
  ) {
    return;
  }

  const fileName = await documentsFolder.saveFile(
    buffer.fileName,
    buffer.title,
    getFileExtension(buffer.fileName ?? "") ?? BUFFER_EXTENSIONS[buffer.kind],
    buffer.content,
  );

  updateBuffer(id, (current) => ({
    fileName,
    savedContent: buffer.content,
    // Keep a newer rename; otherwise adopt the save's collision suffix.
    title: current.title === buffer.title ? stemOf(fileName) : current.title,
  }));
  useBufferStore.getState().refreshFiles();
}

/** Restarts the buffer's 2s save timer. */
function scheduleSave(id: string) {
  const debouncer =
    saveDebouncers.get(id) ??
    new Debouncer(
      () => {
        void queueBufferWrite(id, () => writeBuffer(id, "automatic")).catch(
          (error) => reportFileError(error, "Changes could not be saved."),
        );
      },
      { wait: 2000 },
    );

  saveDebouncers.set(id, debouncer);
  debouncer.maybeExecute();
}

function discardSaveTimer(id: string) {
  saveDebouncers.get(id)?.cancel();
  saveDebouncers.delete(id);
}

// Store
/** Open buffers and the active selection; each edit is saved 2s after typing stops. */
export const useBufferStore = create<BufferStore>()((set, get) => ({
  buffers: [],
  activeId: null,
  files: [],
  fileError: null,
  clearFileError: () => set({ fileError: null }),

  refreshFiles: () => {
    try {
      set({ files: documentsFolder.listFiles() });
    } catch (error) {
      reportFileError(error, "The saved file list could not be loaded.");
    }
  },

  setContent: (id, content) => {
    updateBuffer(id, () => ({ content }));
    scheduleSave(id);
  },

  createBuffer: (kind) => {
    // An empty, never-saved buffer is reused instead of stacking up more untitled ones.
    const blank = get().buffers.find(
      (buffer) =>
        buffer.kind === kind &&
        buffer.fileName === null &&
        !buffer.content.trim(),
    );

    if (blank) {
      set({ activeId: blank.id });

      return;
    }

    const taken = new Set([
      ...get().files.map(stemOf),
      ...get().buffers.map((buffer) => buffer.title),
    ]);

    let title = "untitled";

    for (let suffix = 1; taken.has(title); suffix += 1) {
      title = `untitled_${suffix}`;
    }

    openBuffer({
      title,
      kind,
      content: "",
      fileName: null,
      savedContent: null,
    });
  },

  openFile: async (name) => {
    const open = findBuffer((buffer) => buffer.fileName === name);

    if (open) {
      set({ activeId: open.id });

      return;
    }

    const content = await documentsFolder.readFile(name);

    openBuffer({
      title: stemOf(name),
      kind: kindOf(name),
      content,
      fileName: name,
      savedContent: content,
    });
  },

  flushBuffer: (id) => {
    saveDebouncers.get(id)?.cancel();

    return queueBufferWrite(id, () => writeBuffer(id, "automatic"));
  },

  renameFile: async (name, rawTitle) => {
    const title = toBufferTitle(rawTitle.trim());

    if (!title) {
      throw new Error("Enter a name for the file.");
    }

    const open = findBuffer((buffer) => buffer.fileName === name);

    if (!open) {
      const content = await documentsFolder.readFile(name);

      await documentsFolder.saveFile(
        name,
        title,
        getFileExtension(name) ?? BUFFER_EXTENSIONS[kindOf(name)],
        content,
      );
      get().refreshFiles();

      return;
    }

    saveDebouncers.get(open.id)?.cancel();
    await queueBufferWrite(open.id, async () => {
      updateBuffer(open.id, () => ({ title }));

      try {
        await writeBuffer(open.id, "manual");
      } catch (cause) {
        // A failed rename must not turn into a delayed rename via autosave.
        updateBuffer(open.id, (buffer) =>
          buffer.title === title ? { title: open.title } : {},
        );
        throw cause;
      }
    });
  },

  deleteFile: async (name) => {
    const open = findBuffer((buffer) => buffer.fileName === name);

    const remove = async () => {
      await documentsFolder.deleteFile(name);

      if (open) {
        closeBuffer(open.id);
      }

      get().refreshFiles();
    };

    await (open ? queueBufferWrite(open.id, remove) : remove());
  },

  forceSyncFile: async (name) => {
    const open = findBuffer((buffer) => buffer.fileName === name);

    if (!open) {
      await forceSyncFile(name);

      return;
    }

    saveDebouncers.get(open.id)?.cancel();
    await queueBufferWrite(open.id, async () => {
      await writeBuffer(open.id, "manual");
      await forceSyncFile(
        findBuffer((buffer) => buffer.id === open.id)?.fileName ?? name,
      );
    });
  },

  applySyncedFiles: (changes) => {
    const conflicts: string[] = [];

    for (const change of changes) {
      const buffer = findBuffer(
        (candidate) => candidate.fileName === change.name,
      );

      if (!buffer) {
        continue;
      }

      if (
        buffer.content !== change.before ||
        buffer.title !== stemOf(change.name)
      ) {
        conflicts.push(change.name);

        continue;
      }

      const content = change.after;

      if (content === null) {
        closeBuffer(buffer.id);

        continue;
      }

      discardSaveTimer(buffer.id);
      updateBuffer(buffer.id, (current) => ({
        content,
        savedContent: content,
        syncRevision: current.syncRevision + 1,
      }));
    }

    get().refreshFiles();

    return conflicts;
  },
}));

// App lifecycle
// Write edits still on their timer; the OS can kill a backgrounded app.
AppState.addEventListener("change", (state) => {
  if (state !== "active") {
    for (const debouncer of saveDebouncers.values()) {
      debouncer.flush();
    }
  }
});

/** Returns the buffer currently shown in the editor. */
export function useActiveBuffer() {
  return useBufferStore((state) =>
    state.buffers.find((buffer) => buffer.id === state.activeId),
  );
}
