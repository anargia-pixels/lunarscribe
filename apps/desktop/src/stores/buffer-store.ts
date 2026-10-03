import { errorMessage } from "@lunarscribe/utils/error-message";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  BUFFER_EXTENSIONS,
  stemOf,
  fileKey,
  getFileExtension,
  INVALID_FILE_TITLE_CHARACTERS,
} from "@/lib/editor-files";
import type { ExternalFile, FileTarget } from "@/lib/editor-files";
import { createOperationQueue } from "@/lib/operation-queue";
import { createBufferFileWrites } from "@/stores/file-writes";

export { stemOf } from "@/lib/editor-files";

// Types

type BufferKind = keyof typeof BUFFER_EXTENSIONS;

/** One open document; `content` is the source of truth its editor loads from and saves to. */
export type TextBuffer = {
  id: string;
  title: string;
  kind: BufferKind;
  /** Markdown, or the Excalidraw scene JSON for a drawing; empty for a new drawing. */
  content: string;
  /** Saved file in the documents folder, or null until the first save. */
  fileName: string | null;
  /** Original text file outside the documents folder; edits save back here. */
  externalPath: string | null;
};

export type BufferStore = {
  buffers: TextBuffer[];
  activeId: string;
  /** File shown when the app last closed, reopened on launch; null for an unsaved buffer. */
  lastOpenedFileName: string | null;
  externalFiles: ExternalFile[];
  lastOpenedExternalPath: string | null;
  /** Failed external opens, retained until dismissed or another batch is opened. */
  fileError: string | null;
  clearFileError: () => void;
  renameBuffer: (id: string, title: string) => void;
  setContent: (id: string, content: string) => void;
  saveActiveBuffer: () => Promise<string>;
  openFile: (name: string) => Promise<void>;
  openExternalFiles: (paths: string[]) => Promise<void>;
  createBuffer: (kind: BufferKind, fileNames: string[]) => void;
  deleteFile: (name: string) => Promise<void>;
  renameFile: (target: FileTarget, title: string) => Promise<void>;
  removeExternalFile: (
    target: Extract<FileTarget, { kind: "external" }>,
  ) => Promise<void>;
};

/** Markdown shown by the welcome buffer on first launch. */
const WELCOME_MARKDOWN = `# Welcome to Lunarscribe

Type markdown shortcuts and they turn into rich text:

- \`# \` through \`###### \` for headings
- \`- \` or \`1. \` for lists
- \`> \` for quotes
- \`**bold**\`, \`*italic*\` and \`~~strike~~\` for inline marks
`;

// File names and titles

/** A file's kind, from its extension. */
export function kindOf(fileName: string): BufferKind {
  return getFileExtension(fileName) === BUFFER_EXTENSIONS.drawing
    ? "drawing"
    : "markdown";
}

/** Buffer titles are snake_case: lowercase, with whitespace and slashes turned into `_`. */
export function toBufferTitle(input: string) {
  return input
    .toLowerCase()
    .replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_")
    .replaceAll(/\s/gu, "_");
}

/** Returns a copy of `buffers` with the buffer that has `id` patched. */
function patchBuffer(
  buffers: TextBuffer[],
  id: string,
  patch:
    | Pick<TextBuffer, "title">
    | Pick<TextBuffer, "content">
    | Pick<TextBuffer, "fileName">,
) {
  return buffers.map((buffer) =>
    buffer.id === id ? { ...buffer, ...patch } : buffer,
  );
}

/** A welcome buffer that no file holds, reused when the shown file is deleted. */
function createWelcomeBuffer(): TextBuffer {
  return {
    id: crypto.randomUUID(),
    title: "welcome",
    kind: "markdown",
    content: WELCOME_MARKDOWN,
    fileName: null,
    externalPath: null,
  };
}

// Store

const initialBuffer = createWelcomeBuffer();

// One queue implementation orders file identities, stable buffer IDs, and external selection.
const queueOperation = createOperationQueue();

function findFileBuffer(target: FileTarget) {
  return (
    useBufferStore
      .getState()
      .buffers.find((buffer) =>
        target.kind === "saved"
          ? buffer.fileName === target.name
          : buffer.externalPath === target.path,
      ) ?? null
  );
}

const FILE_OPERATION_POLICIES = {
  renameSaved: { save: "keep", close: false },
  renameExternal: { save: "flush", close: false },
  delete: { save: "keep", close: true },
  remove: { save: "flush", close: true },
} as const;

type FileOperationPolicy =
  (typeof FILE_OPERATION_POLICIES)[keyof typeof FILE_OPERATION_POLICIES];

/** Resolve once, then serialize against saves and apply the operation's explicit save policy. */
function applyFileOperation(
  target: FileTarget,
  policy: FileOperationPolicy,
  operation: (buffer: TextBuffer | null) => Promise<void>,
) {
  const apply = async () => {
    await bufferRestored;

    const open = findFileBuffer(target);

    if (!open) {
      await operation(null);

      return;
    }

    await bufferFileWrites.queueBufferWrite(open.id, async () => {
      const buffer =
        useBufferStore
          .getState()
          .buffers.find((candidate) => candidate.id === open.id) ?? null;

      if (buffer && policy.save === "flush") {
        await bufferFileWrites.writeBuffer(buffer.id, "manual");
      }

      await operation(buffer);

      if (policy.close) {
        closeFileBuffer(buffer);
      }
    });
  };

  // External opens and lifecycle actions share request order, including unopened tracked entries.
  const key = target.kind === "external" ? "external-files" : fileKey(target);

  return queueOperation(key, apply);
}

/** Closing an active file consistently returns to an untouched welcome buffer. */
function selectFallbackBuffer(buffers: TextBuffer[], activeId: string) {
  const active = buffers.find((buffer) => buffer.id === activeId);

  const fallback =
    active ??
    buffers.find(
      (buffer) =>
        buffer.fileName === null &&
        buffer.externalPath === null &&
        buffer.content === WELCOME_MARKDOWN,
    ) ??
    createWelcomeBuffer();

  return {
    buffers: buffers.includes(fallback) ? buffers : [...buffers, fallback],
    activeId: fallback.id,
  };
}

/** Called only after the disk operation succeeds, so failures retain edits and their timer. */
function closeFileBuffer(buffer: TextBuffer | null) {
  if (!buffer) {
    return;
  }

  bufferFileWrites.discardSaveTimer(buffer.id);
  useBufferStore.setState((state) =>
    selectFallbackBuffer(
      state.buffers.filter((candidate) => candidate.id !== buffer.id),
      state.activeId,
    ),
  );
}

/**
 * Open buffers and the active selection; each edit is saved to disk 2s after typing stops.
 * Persists the external file list and last selection; buffer contents are read from disk.
 */
export const useBufferStore = create<BufferStore>()(
  persist(
    (set, get) => ({
      buffers: [initialBuffer],
      activeId: initialBuffer.id,
      lastOpenedFileName: null,
      externalFiles: [],
      lastOpenedExternalPath: null,
      fileError: null,
      clearFileError: () => set({ fileError: null }),

      renameBuffer: (id, rawTitle) => {
        const title = toBufferTitle(rawTitle);

        set((state) => ({
          buffers: patchBuffer(state.buffers, id, { title }),
        }));
        bufferFileWrites.scheduleSave(id);
      },

      setContent: (id, content) => {
        set((state) => ({
          buffers: patchBuffer(state.buffers, id, { content }),
        }));
        bufferFileWrites.scheduleSave(id);
      },

      saveActiveBuffer: async () => {
        const id = get().activeId;
        const result = await bufferFileWrites.saveBufferNow(id);

        if (result.status !== "saved") {
          throw new Error("The buffer is no longer open.");
        }

        return result.fileName;
      },

      openFile: (name) =>
        queueOperation(fileKey({ kind: "saved", name }), async () => {
          await bufferRestored;
          await openSavedFile(name);
        }),

      openExternalFiles: (paths) =>
        queueOperation("external-files", async () => {
          await bufferRestored;

          const failed: string[] = [];

          for (const path of paths) {
            try {
              await openExternalFile(path);
            } catch (error) {
              failed.push(
                `${path}: ${errorMessage(error, "Unable to open text file.")}`,
              );
            }
          }

          set({ fileError: failed.length ? failed.join("\n") : null });
        }),

      createBuffer: (kind, fileNames) => {
        // An empty, never-saved buffer is reused instead of stacking up more untitled ones.
        const blank = get().buffers.find(
          (buffer) =>
            buffer.kind === kind &&
            buffer.fileName === null &&
            buffer.externalPath === null &&
            !buffer.content.trim(),
        );

        if (blank) {
          set({ activeId: blank.id });

          return;
        }

        const taken = new Set([
          ...fileNames.map(stemOf),
          ...get().buffers.map((buffer) => buffer.title),
        ]);

        let title = "untitled";

        for (let suffix = 1; taken.has(title); suffix += 1) {
          title = `untitled_${suffix}`;
        }

        const buffer: TextBuffer = {
          id: crypto.randomUUID(),
          title,
          kind,
          content: "",
          fileName: null,
          externalPath: null,
        };

        set((state) => ({
          buffers: [...state.buffers, buffer],
          activeId: buffer.id,
        }));
      },

      // Delete discards pending edits only after deletion; Remove flushes them before closing.
      deleteFile: (name) =>
        applyFileOperation(
          { kind: "saved", name },
          FILE_OPERATION_POLICIES.delete,
          async (buffer) => {
            await window.lunarscribe.deleteFile(buffer?.fileName ?? name);
          },
        ),

      renameFile: (target, rawTitle) =>
        applyFileOperation(
          target,
          target.kind === "external"
            ? FILE_OPERATION_POLICIES.renameExternal
            : FILE_OPERATION_POLICIES.renameSaved,
          async (buffer) => {
            if (target.kind === "external") {
              await renameExternalFile(target.path, rawTitle);

              return;
            }

            const title = toBufferTitle(rawTitle.trim());

            if (!title) {
              throw new Error("Enter a name for the file.");
            }

            if (!buffer) {
              const content = await window.lunarscribe.readFile(target.name);
              await window.lunarscribe.saveFile(
                target.name,
                title,
                getFileExtension(target.name) ??
                  BUFFER_EXTENSIONS[kindOf(target.name)],
                content,
              );

              return;
            }

            set((state) => ({
              buffers: patchBuffer(state.buffers, buffer.id, { title }),
            }));

            try {
              await bufferFileWrites.writeBuffer(buffer.id, "manual");
            } catch (cause) {
              // A failed sidebar rename must not turn into a delayed rename via autosave.
              set((state) => ({
                buffers: state.buffers.map((candidate) =>
                  candidate.id === buffer.id && candidate.title === title
                    ? { ...candidate, title: buffer.title }
                    : candidate,
                ),
              }));
              throw cause;
            }
          },
        ),

      removeExternalFile: (target) =>
        applyFileOperation(target, FILE_OPERATION_POLICIES.remove, async () => {
          set((state) => ({
            externalFiles: state.externalFiles.filter(
              (file) => file.path !== target.path,
            ),
          }));
        }),
    }),
    {
      name: "lunarscribe-buffers",
      partialize: (state) => ({
        lastOpenedFileName: state.lastOpenedFileName,
        externalFiles: state.externalFiles,
        lastOpenedExternalPath: state.lastOpenedExternalPath,
      }),
    },
  ),
);

/** Reuse an open saved buffer, or read it before selecting it. */
async function openSavedFile(name: string) {
  const open = findFileBuffer({ kind: "saved", name });

  if (open) {
    useBufferStore.setState({ activeId: open.id });

    return;
  }

  const content = await window.lunarscribe.readFile(name);

  const buffer: TextBuffer = {
    id: crypto.randomUUID(),
    title: stemOf(name),
    kind: kindOf(name),
    content,
    fileName: name,
    externalPath: null,
  };

  useBufferStore.setState((state) => ({
    buffers: [...state.buffers, buffer],
    activeId: buffer.id,
  }));
}

/** Rename a tracked source entry and patch both its canonical path and any open buffer. */
async function renameExternalFile(path: string, title: string) {
  const file = useBufferStore
    .getState()
    .externalFiles.find((candidate) => candidate.path === path);

  if (!file) {
    throw new Error("The external file is no longer tracked.");
  }

  await window.lunarscribe.readExternalFile(file.sourcePath ?? path);

  const renamed = await window.lunarscribe.renameExternalFile(
    path,
    file.sourcePath ?? path,
    title,
  );

  useBufferStore.setState((state) => ({
    externalFiles: state.externalFiles.map((candidate) =>
      candidate.path === path ? renamed : candidate,
    ),
    buffers: state.buffers.map((buffer) =>
      buffer.externalPath === path
        ? { ...buffer, externalPath: renamed.path, title: stemOf(renamed.name) }
        : buffer,
    ),
  }));
}

/** Opens one external buffer, retaining its source path and reusing an already-open buffer. */
async function openExternalFile(path: string) {
  const { buffers, externalFiles } = useBufferStore.getState();

  const openBuffer = buffers.find((buffer) => buffer.externalPath === path);

  if (openBuffer) {
    useBufferStore.setState({ activeId: openBuffer.id });

    return;
  }

  const trackedFile = externalFiles.find((file) => file.path === path);

  const file = await window.lunarscribe.readExternalFile(
    trackedFile?.sourcePath ?? path,
  );

  useBufferStore.setState((state) => {
    // Canonical paths reuse a buffer opened through a different symlink.
    const existingBuffer = state.buffers.find(
      (buffer) => buffer.externalPath === file.path,
    );

    if (existingBuffer) {
      return { activeId: existingBuffer.id };
    }

    const buffer: TextBuffer = {
      id: crypto.randomUUID(),
      title: stemOf(file.name),
      kind: "markdown",
      content: file.markdown,
      fileName: null,
      externalPath: file.path,
    };

    const externalFile: ExternalFile = {
      path: file.path,
      name: file.name,
      sourcePath: file.sourcePath,
    };

    const hasTrackedFile = state.externalFiles.some(
      (external) => external.path === file.path,
    );

    return {
      buffers: [...state.buffers, buffer],
      externalFiles: hasTrackedFile
        ? state.externalFiles.map((tracked) =>
            tracked.path === file.path ? externalFile : tracked,
          )
        : [...state.externalFiles, externalFile],
      activeId: buffer.id,
    };
  });
}

const bufferFileWrites = createBufferFileWrites(useBufferStore);

// Persisted selection

// Tracks the shown buffer's file, so opening, saving under a new name and deleting all
// keep the persisted name current.
useBufferStore.subscribe((state) => {
  const buffer = state.buffers.find(
    (candidate) => candidate.id === state.activeId,
  );

  const fileName = buffer?.fileName ?? null;
  const externalPath = buffer?.externalPath ?? null;

  if (
    fileName !== state.lastOpenedFileName ||
    externalPath !== state.lastOpenedExternalPath
  ) {
    useBufferStore.setState({
      lastOpenedFileName: fileName,
      lastOpenedExternalPath: externalPath,
    });
  }
});

// Reopen the last file; if it is gone, the welcome buffer stays and the name is cleared.
async function restoreLastBuffer() {
  const { lastOpenedFileName, lastOpenedExternalPath } =
    useBufferStore.getState();

  if (lastOpenedExternalPath) {
    await openExternalFile(lastOpenedExternalPath).catch((error) => {
      useBufferStore.setState({
        fileError: `${lastOpenedExternalPath}: ${errorMessage(error, "Unable to reopen text file.")}`,
      });
    });

    return;
  }

  if (lastOpenedFileName) {
    await openSavedFile(lastOpenedFileName).catch(() =>
      useBufferStore.setState({ lastOpenedFileName: null }),
    );
  }
}

/** File-open requests wait for restoration so their selection wins on cold launch. */
const bufferRestored = restoreLastBuffer();

// Hooks

/** Returns the buffer currently shown in the editor. */
export function useActiveBuffer() {
  return useBufferStore((state) =>
    state.buffers.find((buffer) => buffer.id === state.activeId),
  );
}
