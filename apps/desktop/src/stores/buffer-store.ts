import { Debouncer } from "@tanstack/pacer/debouncer";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getFileExtension } from "@/lib/editor-files";
import type { ExternalFile } from "@/lib/editor-files";

/** File extension of each buffer kind. */
const EXTENSIONS = { markdown: ".md", drawing: ".draw" } as const;

// Types

type BufferKind = keyof typeof EXTENSIONS;

/** One open document; `content` is the source of truth its editor loads from and saves to. */
type TextBuffer = {
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

type BufferStore = {
  buffers: TextBuffer[];
  activeId: string;
  /** File shown when the app last closed, reopened on launch; null for an unsaved buffer. */
  lastOpenedFileName: string | null;
  externalFiles: ExternalFile[];
  lastOpenedExternalPath: string | null;
  fileError: string | null;
  renameBuffer: (id: string, title: string) => void;
  setContent: (id: string, content: string) => void;
  saveActiveBuffer: () => Promise<string>;
  openFile: (name: string) => Promise<void>;
  openExternalFiles: (paths: string[]) => Promise<void>;
  createBuffer: (kind: BufferKind, fileNames: string[]) => void;
  deleteFile: (name: string) => Promise<void>;
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
  return getFileExtension(fileName) === EXTENSIONS.drawing
    ? "drawing"
    : "markdown";
}

/** A file's name without its extension, which is its buffer title. */
export function stemOf(fileName: string) {
  return fileName.slice(0, fileName.lastIndexOf("."));
}

/** Buffer titles are snake_case: lowercase, with whitespace and slashes turned into `_`. */
export function toBufferTitle(input: string) {
  return input.toLowerCase().replaceAll(/[\s/\\]/gu, "_");
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

let pendingFileOpen = Promise.resolve();

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

      renameBuffer: (id, rawTitle) => {
        const title = toBufferTitle(rawTitle);

        set((state) => ({
          buffers: patchBuffer(state.buffers, id, { title }),
        }));
        scheduleSave(id);
      },

      setContent: (id, content) => {
        set((state) => ({
          buffers: patchBuffer(state.buffers, id, { content }),
        }));
        scheduleSave(id);
      },

      saveActiveBuffer: async () => {
        const id = get().activeId;
        saveDebouncers.get(id)?.cancel();

        const fileName = await saveBuffer(id, true);

        if (fileName === null) {
          throw new Error("The buffer is no longer open.");
        }

        set({ fileError: null });

        return fileName;
      },

      openFile: async (name) => {
        const open = get().buffers.find((buffer) => buffer.fileName === name);

        if (open) {
          set({ activeId: open.id });

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

        set((state) => ({
          buffers: [...state.buffers, buffer],
          activeId: buffer.id,
        }));
      },

      openExternalFiles: (paths) => {
        const openFiles = async () => {
          await bufferRestored;

          const failed: string[] = [];

          for (const path of paths) {
            try {
              await openExternalFile(path);
            } catch (error) {
              failed.push(
                `${path}: ${error instanceof Error ? error.message : "Unable to open text file."}`,
              );
            }
          }

          set({ fileError: failed.length ? failed.join("\n") : null });
        };

        // Keep the selection in request order even when file reads take different amounts of time.
        pendingFileOpen = pendingFileOpen.then(openFiles, openFiles);

        return pendingFileOpen;
      },

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

      deleteFile: async (name) => {
        const open = get().buffers.find((buffer) => buffer.fileName === name);

        if (!open) {
          await window.lunarscribe.deleteFile(name);

          return;
        }

        await queueBufferWrite(open.id, async () => {
          // An earlier queued save may have renamed the file.
          const fileName =
            get().buffers.find((buffer) => buffer.id === open.id)?.fileName ??
            name;

          await window.lunarscribe.deleteFile(fileName);

          // Drop the buffer so later queued saves cannot recreate the file.
          saveDebouncers.get(open.id)?.cancel();
          saveDebouncers.delete(open.id);

          const buffers = get().buffers.filter(
            (buffer) => buffer.id !== open.id,
          );

          if (get().activeId !== open.id) {
            set({ buffers });

            return null;
          }

          // Deleting the shown file falls back to the welcome text, reusing an untouched copy.
          const welcome =
            buffers.find(
              (buffer) =>
                buffer.fileName === null &&
                buffer.externalPath === null &&
                buffer.content === WELCOME_MARKDOWN,
            ) ?? createWelcomeBuffer();

          set({
            buffers: buffers.includes(welcome)
              ? buffers
              : [...buffers, welcome],
            activeId: welcome.id,
          });

          return null;
        });
      },
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

/** Opens one external buffer, retaining its source path and reusing an already-open buffer. */
async function openExternalFile(path: string) {
  const { buffers, externalFiles } = useBufferStore.getState();

  const openBuffer = buffers.find((buffer) => buffer.externalPath === path);

  if (openBuffer) {
    useBufferStore.setState({ activeId: openBuffer.id, fileError: null });

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
      return { activeId: existingBuffer.id, fileError: null };
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
      fileError: null,
    };
  });
}

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
        fileError:
          error instanceof Error
            ? error.message
            : "Unable to reopen text file.",
      });
    });

    return;
  }

  if (lastOpenedFileName) {
    await useBufferStore
      .getState()
      .openFile(lastOpenedFileName)
      .catch(() => useBufferStore.setState({ lastOpenedFileName: null }));
  }
}

/** File-open requests wait for restoration so their selection wins on cold launch. */
const bufferRestored = restoreLastBuffer();

// Saving to disk

const pendingBufferWrites = new Map<string, Promise<string | null>>();

/** Orders saves and deletion for each buffer; a failed write does not block retries. */
async function queueBufferWrite(
  id: string,
  write: () => Promise<string | null>,
): Promise<string | null> {
  const previousWrite = pendingBufferWrites.get(id);

  const pendingWrite = previousWrite
    ? previousWrite.then(write, write)
    : write();

  pendingBufferWrites.set(id, pendingWrite);

  try {
    return await pendingWrite;
  } finally {
    if (pendingBufferWrites.get(id) === pendingWrite) {
      pendingBufferWrites.delete(id);
    }
  }
}

/** Queues a save so an earlier autosave cannot overwrite it or create a second file. */
function saveBuffer(id: string, force = false): Promise<string | null> {
  return queueBufferWrite(id, () => writeBuffer(id, force));
}

/** Writes the latest buffer and records its file name; a manual save also creates an empty file. */
async function writeBuffer(id: string, force: boolean): Promise<string | null> {
  const buffer = useBufferStore
    .getState()
    .buffers.find((candidate) => candidate.id === id);

  if (!buffer) {
    return null;
  }

  if (buffer.externalPath) {
    await window.lunarscribe.saveExternalFile(
      buffer.externalPath,
      buffer.content,
    );

    return (
      useBufferStore
        .getState()
        .externalFiles.find((file) => file.path === buffer.externalPath)
        ?.name ?? buffer.title
    );
  }

  // Autosave waits for a new buffer to have content; manual saves may create empty files.
  if (!force && buffer.fileName === null && !buffer.content.trim()) {
    return null;
  }

  const fileName = await window.lunarscribe.saveFile(
    buffer.fileName,
    buffer.title,
    getFileExtension(buffer.fileName ?? "") ?? EXTENSIONS[buffer.kind],
    buffer.content,
  );

  useBufferStore.setState((state) => ({
    buffers: patchBuffer(state.buffers, id, { fileName }),
  }));

  return fileName;
}

const saveDebouncers = new Map<string, Debouncer<() => undefined>>();

/** Restarts the buffer's 2s save timer. */
function scheduleSave(id: string) {
  const debouncer =
    saveDebouncers.get(id) ??
    new Debouncer(
      () => {
        void saveBuffer(id).catch((error) => {
          useBufferStore.setState({
            fileError:
              error instanceof Error
                ? error.message
                : "Unable to save the buffer.",
          });
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

// Hooks

/** Returns the buffer currently shown in the editor. */
export function useActiveBuffer() {
  return useBufferStore((state) =>
    state.buffers.find((buffer) => buffer.id === state.activeId),
  );
}
