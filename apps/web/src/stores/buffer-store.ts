import { errorMessage } from "@lunarscribe/utils/error-message";
import { isImageFileName, rewriteImageEmbeds } from "@lunarscribe/utils/images";
import { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import {
  folderOf,
  isInFolder,
  replaceFolder,
} from "@lunarscribe/utils/saved-paths";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  BUFFER_EXTENSIONS,
  stemOf,
  fileKey,
  getFileExtension,
  INVALID_FILE_TITLE_CHARACTERS,
  isTextFile,
} from "@/lib/editor-files";
import type { ExternalFile, FileTarget } from "@/lib/editor-files";
import {
  forgetExternalFile,
  listExternalFiles,
  openExternalHandle,
  readExternalFile,
  renameExternalFile as renameExternalHandle,
} from "@/lib/external-files";
import type { OpenedExternalFile } from "@/lib/external-files";
import * as savedFiles from "@/lib/saved-files";
import { forcePullFile, forceSyncFile } from "@/lib/sync/sync-service";
import type { SyncedFileChange } from "@/lib/sync/sync-types";
import { useFileAccessStore } from "@/stores/file-access-store";
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
  savedContent: string | null;
  syncRevision: number;
  /** Saved file in browser storage, or null until the first save. */
  fileName: string | null;
  /** Folder a new buffer is first saved in, `""` for the top level; a saved file keeps its own. */
  folder: string;
  /** ID of the external file this buffer edits; edits save back to that file. */
  externalId: string | null;
};

export type BufferStore = {
  buffers: TextBuffer[];
  activeId: string;
  /** Saved image shown in the image viewer in place of the active buffer, or null. */
  viewedImage: string | null;
  /** File shown when the app last closed, reopened on launch; null for an unsaved buffer. */
  lastOpenedFileName: string | null;
  externalFiles: ExternalFile[];
  lastOpenedExternalId: string | null;
  /** Failed external opens, retained until dismissed or another batch is opened. */
  fileError: string | null;
  clearFileError: () => void;
  applySyncedFiles: (changes: SyncedFileChange[]) => string[];
  renameBuffer: (id: string, title: string) => void;
  setContent: (id: string, content: string) => void;
  saveActiveBuffer: () => Promise<string>;
  forceSyncFile: (name: string) => Promise<void>;
  /** Replaces the saved file and its buffer with the remote copy, discarding pending edits. */
  forcePullFile: (name: string) => Promise<void>;
  /** Opens a saved note or drawing as a buffer, or shows a saved image in the viewer. */
  openFile: (name: string) => Promise<void>;
  openExternalFile: (id: string) => Promise<void>;
  /** Opens picked, dropped, or launched files; without file access they become saved notes. */
  openExternalHandles: (
    handles: FileSystemFileHandle[],
    files: File[],
  ) => Promise<void>;
  /** Starts an untitled buffer that saves into `folder`, `""` for the top level. */
  createBuffer: (
    kind: BufferKind,
    fileNames: string[],
    folder?: string,
  ) => void;
  deleteFile: (name: string) => Promise<void>;
  /** Moves a saved file into `folder`, after writing pending edits. */
  moveFile: (name: string, folder: string) => Promise<void>;
  /** Renames a folder and repoints open buffers inside it; returns its new path. */
  renameFolder: (path: string, name: string) => Promise<string>;
  /** Deletes a folder with everything inside and closes buffers it held. */
  deleteFolder: (path: string) => Promise<void>;
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

/** Keeps a renamed saved file's access time and scroll position under its new name. */
function moveSavedAccess(fromName: string, toName: string) {
  useFileAccessStore
    .getState()
    .moveAccess(
      fileKey({ kind: "saved", name: fromName }),
      fileKey({ kind: "saved", name: toName }),
    );
}

/** Saved file names inside `folder` that have an access time or scroll position. */
function trackedNamesInFolder(folder: string) {
  const savedPrefix = fileKey({ kind: "saved", name: "" });
  const { accessedAt, scrollTops } = useFileAccessStore.getState();

  return [
    ...new Set([...Object.keys(accessedAt), ...Object.keys(scrollTops)]),
  ].flatMap((key) => {
    const name = key.slice(savedPrefix.length);

    return key.startsWith(savedPrefix) && isInFolder(name, folder)
      ? [name]
      : [];
  });
}

/** Keeps the access times and scroll positions of files in a renamed folder under their new names. */
function moveFolderAccess(fromFolder: string, toFolder: string) {
  for (const name of trackedNamesInFolder(fromFolder)) {
    moveSavedAccess(name, replaceFolder(name, fromFolder, toFolder));
  }
}

/** The `fileKey` of a buffer's saved or external file; null until it is first saved. */
export function bufferFileKey(
  buffer: Pick<TextBuffer, "fileName" | "externalId" | "title">,
) {
  if (buffer.fileName !== null) {
    return fileKey({ kind: "saved", name: buffer.fileName });
  }

  return buffer.externalId === null
    ? null
    : fileKey({ kind: "external", id: buffer.externalId, name: buffer.title });
}

/** Open buffers whose saved file sits inside `folder`. */
function buffersInFolder(folder: string) {
  return useBufferStore
    .getState()
    .buffers.filter(
      (buffer) =>
        buffer.fileName !== null && isInFolder(buffer.fileName, folder),
    );
}

/** A welcome buffer that no file holds, reused when the shown file is deleted. */
function createWelcomeBuffer(): TextBuffer {
  return {
    id: crypto.randomUUID(),
    title: "welcome",
    kind: "markdown",
    content: WELCOME_MARKDOWN,
    savedContent: null,
    syncRevision: 0,
    fileName: null,
    folder: "",
    externalId: null,
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
          : buffer.externalId === target.id,
      ) ?? null
  );
}

const FILE_OPERATION_POLICIES = {
  renameSaved: { save: "keep", close: false },
  renameExternal: { save: "flush", close: false },
  delete: { save: "keep", close: true },
  remove: { save: "flush", close: true },
  forceSync: { save: "flush", close: false },
  forcePull: { save: "keep", close: false },
  move: { save: "flush", close: false },
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
        buffer.externalId === null &&
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
 * Open buffers and the active selection; each edit is saved 2s after typing stops.
 * Persists the last selection; buffer contents and external files are read from IndexedDB.
 */
export const useBufferStore = create<BufferStore>()(
  persist(
    (set, get) => ({
      buffers: [initialBuffer],
      activeId: initialBuffer.id,
      viewedImage: null,
      lastOpenedFileName: null,
      externalFiles: [],
      lastOpenedExternalId: null,
      fileError: null,
      clearFileError: () => set({ fileError: null }),
      applySyncedFiles: (changes) => {
        const conflicts: string[] = [];

        for (const change of changes) {
          const buffer = get().buffers.find(
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

          bufferFileWrites.discardSaveTimer(buffer.id);

          if (change.after === null) {
            closeFileBuffer(buffer);
          } else {
            const content = change.after;
            set((state) => ({
              buffers: state.buffers.map((candidate) =>
                candidate.id === buffer.id
                  ? {
                      ...candidate,
                      content,
                      savedContent: content,
                      syncRevision: candidate.syncRevision + 1,
                    }
                  : candidate,
              ),
            }));
          }
        }

        return conflicts;
      },

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

      forceSyncFile: (name) =>
        applyFileOperation(
          { kind: "saved", name },
          FILE_OPERATION_POLICIES.forceSync,
          async (buffer) => {
            const current = buffer
              ? get().buffers.find((candidate) => candidate.id === buffer.id)
              : null;

            await forceSyncFile(current?.fileName ?? name);
          },
        ),

      forcePullFile: (name) =>
        applyFileOperation(
          { kind: "saved", name },
          FILE_OPERATION_POLICIES.forcePull,
          async (buffer) => {
            const current = buffer
              ? get().buffers.find((candidate) => candidate.id === buffer.id)
              : null;

            const change = await forcePullFile(current?.fileName ?? name);

            if (!current) {
              return;
            }

            if (change.after === null) {
              closeFileBuffer(current);

              return;
            }

            const content = change.after;
            bufferFileWrites.discardSaveTimer(current.id);
            set((state) => ({
              buffers: state.buffers.map((candidate) =>
                candidate.id === current.id
                  ? {
                      ...candidate,
                      title: stemOf(change.name),
                      content,
                      savedContent: content,
                      syncRevision: candidate.syncRevision + 1,
                    }
                  : candidate,
              ),
            }));
          },
        ),

      openFile: (name) =>
        queueOperation(fileKey({ kind: "saved", name }), async () => {
          await bufferRestored;

          if (isImageFileName(name)) {
            set({ viewedImage: name });

            return;
          }

          await openSavedFile(name);
        }),

      openExternalFile: (id) =>
        queueOperation("external-files", async () => {
          await bufferRestored;
          await openTrackedExternalFile(id);
        }),

      openExternalHandles: (handles, files) =>
        queueOperation("external-files", async () => {
          await bufferRestored;

          const failed: string[] = [];

          for (const handle of handles) {
            try {
              selectExternalFile(await openExternalHandle(handle));
            } catch (error) {
              failed.push(
                `${handle.name}: ${errorMessage(error, "Unable to open text file.")}`,
              );
            }
          }

          for (const file of files) {
            try {
              await importTextFile(file);
            } catch (error) {
              failed.push(
                `${file.name}: ${errorMessage(error, "Unable to import text file.")}`,
              );
            }
          }

          set({ fileError: failed.length ? failed.join("\n") : null });
        }),

      createBuffer: (kind, fileNames, folder = "") => {
        // An empty, never-saved buffer is reused instead of stacking up more untitled ones.
        const blank = get().buffers.find(
          (buffer) =>
            buffer.kind === kind &&
            buffer.fileName === null &&
            buffer.externalId === null &&
            !buffer.content.trim(),
        );

        if (blank) {
          set((state) => ({
            buffers: state.buffers.map((buffer) =>
              buffer.id === blank.id ? { ...buffer, folder } : buffer,
            ),
            activeId: blank.id,
            viewedImage: null,
          }));

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
          savedContent: null,
          syncRevision: 0,
          fileName: null,
          folder,
          externalId: null,
        };

        set((state) => ({
          buffers: [...state.buffers, buffer],
          activeId: buffer.id,
          viewedImage: null,
        }));
      },

      // Delete discards pending edits only after deletion; Remove flushes them before closing.
      deleteFile: (name) =>
        applyFileOperation(
          { kind: "saved", name },
          FILE_OPERATION_POLICIES.delete,
          async (buffer) => {
            await savedFiles.deleteFile(buffer?.fileName ?? name);
            useFileAccessStore
              .getState()
              .forgetScrollTops([
                fileKey({ kind: "saved", name: buffer?.fileName ?? name }),
              ]);

            if (get().viewedImage === name) {
              set({ viewedImage: null });
            }
          },
        ),

      moveFile: async (name, folder) => {
        let movedImage: string | null = null;

        await applyFileOperation(
          { kind: "saved", name },
          FILE_OPERATION_POLICIES.move,
          async (buffer) => {
            const current = buffer
              ? (get().buffers.find((candidate) => candidate.id === buffer.id)
                  ?.fileName ?? name)
              : name;

            const moved = await savedFiles.moveFile(current, folder);

            if (buffer) {
              set((state) => ({
                buffers: state.buffers.map((candidate) =>
                  candidate.id === buffer.id
                    ? { ...candidate, fileName: moved, folder }
                    : candidate,
                ),
              }));
            }

            moveSavedAccess(current, moved);

            if (isImageFileName(current) && moved !== current) {
              movedImage = moved;
              set((state) => ({
                viewedImage:
                  state.viewedImage === current ? moved : state.viewedImage,
              }));
            }
          },
        );

        if (movedImage) {
          await updateImageEmbeds(name, movedImage);
        }
      },

      renameFolder: (path, name) =>
        queueOperation(`folder:${path}`, async () => {
          await bufferRestored;

          // Write pending edits first, so no later save looks for a file under the old path.
          for (const buffer of buffersInFolder(path)) {
            if (
              buffer.content !== buffer.savedContent ||
              buffer.title !== stemOf(buffer.fileName ?? "")
            ) {
              await bufferFileWrites.saveBufferNow(buffer.id);
            }
          }

          const renamed = await savedFiles.renameFolder(path, name);

          if (renamed === path) {
            return path;
          }

          set((state) => ({
            buffers: state.buffers.map((buffer) => {
              if (
                buffer.fileName !== null &&
                isInFolder(buffer.fileName, path)
              ) {
                const fileName = replaceFolder(buffer.fileName, path, renamed);

                return { ...buffer, fileName, folder: folderOf(fileName) };
              }

              return buffer.fileName === null && isInFolder(buffer.folder, path)
                ? {
                    ...buffer,
                    folder: replaceFolder(buffer.folder, path, renamed),
                  }
                : buffer;
            }),
            viewedImage:
              state.viewedImage !== null && isInFolder(state.viewedImage, path)
                ? replaceFolder(state.viewedImage, path, renamed)
                : state.viewedImage,
          }));
          moveFolderAccess(path, renamed);

          return renamed;
        }),

      deleteFolder: (path) =>
        queueOperation(`folder:${path}`, async () => {
          await bufferRestored;

          const inside = buffersInFolder(path);

          for (const buffer of inside) {
            bufferFileWrites.discardSaveTimer(buffer.id);
          }

          await savedFiles.deleteFolder(path);
          useFileAccessStore
            .getState()
            .forgetScrollTops(
              trackedNamesInFolder(path).map((name) =>
                fileKey({ kind: "saved", name }),
              ),
            );

          for (const buffer of inside) {
            closeFileBuffer(buffer);
          }

          // New buffers meant for the folder save at the top level instead.
          set((state) => ({
            buffers: state.buffers.map((buffer) =>
              buffer.fileName === null && isInFolder(buffer.folder, path)
                ? { ...buffer, folder: "" }
                : buffer,
            ),
            viewedImage:
              state.viewedImage !== null && isInFolder(state.viewedImage, path)
                ? null
                : state.viewedImage,
          }));
        }),

      renameFile: async (target, rawTitle) => {
        if (target.kind === "saved" && isImageFileName(target.name)) {
          await renameImage(target.name, rawTitle);

          return;
        }

        await applyFileOperation(
          target,
          target.kind === "external"
            ? FILE_OPERATION_POLICIES.renameExternal
            : FILE_OPERATION_POLICIES.renameSaved,
          async (buffer) => {
            if (target.kind === "external") {
              await renameExternalFile(target.id, rawTitle);

              return;
            }

            const title = toBufferTitle(rawTitle.trim());

            if (!title) {
              throw new Error("Enter a name for the file.");
            }

            if (!buffer) {
              const content = await savedFiles.readFile(target.name);

              const name = await savedFiles.saveFile(
                target.name,
                folderOf(target.name),
                title,
                getFileExtension(target.name) ??
                  BUFFER_EXTENSIONS[kindOf(target.name)],
                content,
                content,
              );

              moveSavedAccess(target.name, name);

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

            const renamed = get().buffers.find(
              (candidate) => candidate.id === buffer.id,
            );

            if (renamed?.fileName) {
              moveSavedAccess(target.name, renamed.fileName);
            }
          },
        );
      },

      removeExternalFile: (target) =>
        applyFileOperation(target, FILE_OPERATION_POLICIES.remove, async () => {
          await forgetExternalFile(target.id);
          set((state) => ({
            externalFiles: state.externalFiles.filter(
              (file) => file.id !== target.id,
            ),
          }));
          useFileAccessStore.getState().forgetScrollTops([fileKey(target)]);
        }),
    }),
    {
      name: "lunarscribe-buffers",
      partialize: (state) => ({
        lastOpenedFileName: state.lastOpenedFileName,
        lastOpenedExternalId: state.lastOpenedExternalId,
      }),
    },
  ),
);

/** Renames a saved image in place, then points the embeds of it at the new name. */
async function renameImage(name: string, title: string) {
  let renamed = name;

  await queueOperation(fileKey({ kind: "saved", name }), async () => {
    renamed = await savedFiles.renameImage(name, title);
    moveSavedAccess(name, renamed);
    useBufferStore.setState((state) => ({
      viewedImage: state.viewedImage === name ? renamed : state.viewedImage,
    }));
  });

  if (renamed !== name) {
    await updateImageEmbeds(name, renamed);
  }
}

/**
 * Points every embed of the image `from` at `to` after it was renamed or moved, as
 * Obsidian updates links: in open buffers, which save as usual, and in saved notes in
 * browser storage. Throws once every note was tried, naming the ones left unchanged.
 */
async function updateImageEmbeds(from: string, to: string) {
  const { files } = await savedFiles.listFiles();
  const imagesAfter = files.filter(isImageFileName);
  const imagesBefore = imagesAfter.map((name) => (name === to ? from : name));
  const failed: string[] = [];

  const rewrite = (markdown: string, note: string) =>
    rewriteImageEmbeds(markdown, note, from, to, imagesBefore, imagesAfter);

  for (const note of files.filter(isTextFile)) {
    try {
      // Ordered with opens of the same file, so a read never misses the rewrite.
      await queueOperation(fileKey({ kind: "saved", name: note }), async () => {
        const buffer = findFileBuffer({ kind: "saved", name: note });

        if (buffer) {
          const content = rewrite(buffer.content, note);

          if (content !== buffer.content) {
            useBufferStore.setState((state) => ({
              buffers: state.buffers.map((candidate) =>
                candidate.id === buffer.id
                  ? {
                      ...candidate,
                      content,
                      syncRevision: candidate.syncRevision + 1,
                    }
                  : candidate,
              ),
            }));
            bufferFileWrites.scheduleSave(buffer.id);
          }

          return;
        }

        const markdown = await savedFiles.readFile(note);
        const content = rewrite(markdown, note);

        if (content !== markdown) {
          await savedFiles.saveFile(
            note,
            folderOf(note),
            stemOf(note),
            getFileExtension(note) ?? BUFFER_EXTENSIONS.markdown,
            content,
            markdown,
          );
        }
      });
    } catch {
      failed.push(note);
    }
  }

  if (failed.length) {
    throw new Error(
      `Embeds of the image in ${failed.join(", ")} still point at ${from}. Update them by hand.`,
    );
  }
}

/** Reuse an open saved buffer, or read it before selecting it. */
async function openSavedFile(name: string) {
  const open = findFileBuffer({ kind: "saved", name });

  if (open) {
    useBufferStore.setState({ activeId: open.id, viewedImage: null });

    return;
  }

  const content = await savedFiles.readFile(name);

  const buffer: TextBuffer = {
    id: crypto.randomUUID(),
    title: stemOf(name),
    kind: kindOf(name),
    content,
    savedContent: content,
    syncRevision: 0,
    fileName: name,
    folder: folderOf(name),
    externalId: null,
  };

  useBufferStore.setState((state) => ({
    buffers: [...state.buffers, buffer],
    activeId: buffer.id,
    viewedImage: null,
  }));
}

/** Rename a tracked external file and patch both its entry and any open buffer. */
async function renameExternalFile(id: string, title: string) {
  const renamed = await renameExternalHandle(id, title);

  useBufferStore.setState((state) => ({
    externalFiles: state.externalFiles.map((candidate) =>
      candidate.id === id ? renamed : candidate,
    ),
    buffers: state.buffers.map((buffer) =>
      buffer.externalId === id
        ? { ...buffer, title: stemOf(renamed.name) }
        : buffer,
    ),
  }));
}

/** Selects the open buffer for an external file, or opens a new one. */
function selectExternalFile(file: OpenedExternalFile) {
  useBufferStore.setState((state) => {
    const existingBuffer = state.buffers.find(
      (buffer) => buffer.externalId === file.id,
    );

    if (existingBuffer) {
      return { activeId: existingBuffer.id, viewedImage: null };
    }

    const buffer: TextBuffer = {
      id: crypto.randomUUID(),
      title: stemOf(file.name),
      kind: "markdown",
      content: file.markdown,
      savedContent: file.markdown,
      syncRevision: 0,
      fileName: null,
      folder: "",
      externalId: file.id,
    };

    const externalFile: ExternalFile = { id: file.id, name: file.name };

    const hasTrackedFile = state.externalFiles.some(
      (external) => external.id === file.id,
    );

    return {
      buffers: [...state.buffers, buffer],
      externalFiles: hasTrackedFile
        ? state.externalFiles.map((tracked) =>
            tracked.id === file.id ? externalFile : tracked,
          )
        : [...state.externalFiles, externalFile],
      activeId: buffer.id,
      viewedImage: null,
    };
  });
}

/** Reuses an open buffer, or reads the tracked file before selecting it. */
async function openTrackedExternalFile(id: string) {
  const openBuffer = useBufferStore
    .getState()
    .buffers.find((buffer) => buffer.externalId === id);

  if (openBuffer) {
    useBufferStore.setState({ activeId: openBuffer.id, viewedImage: null });

    return;
  }

  selectExternalFile(await readExternalFile(id));
}

/** Copies a text file into browser storage when this browser cannot write it back. */
async function importTextFile(file: File) {
  if (!isTextFile(file.name)) {
    throw new Error("Choose a local .md, .markdown, or .txt file.");
  }

  const markdown = await file.text();

  const name = await savedFiles.saveFile(
    null,
    "",
    toBufferTitle(stemOf(file.name)),
    BUFFER_EXTENSIONS.markdown,
    markdown,
    null,
  );

  await openSavedFile(name);
}

const bufferFileWrites = createBufferFileWrites(useBufferStore);

// Persisted selection

// Tracks the shown buffer's file, so opening, saving under a new name and deleting all
// keep the persisted name current. Showing a file, or typing in it, counts as accessing it.
useBufferStore.subscribe((state) => {
  const buffer = state.buffers.find(
    (candidate) => candidate.id === state.activeId,
  );

  const fileName = buffer?.fileName ?? null;
  const externalId = buffer?.externalId ?? null;
  const { recordAccess } = useFileAccessStore.getState();

  const key = buffer ? bufferFileKey(buffer) : null;

  if (key !== null) {
    recordAccess(key);
  }

  if (
    fileName !== state.lastOpenedFileName ||
    externalId !== state.lastOpenedExternalId
  ) {
    useBufferStore.setState({
      lastOpenedFileName: fileName,
      lastOpenedExternalId: externalId,
    });
  }
});

// Reopen the last file; if it is gone, the welcome buffer stays and the selection is cleared.
async function restoreLastBuffer() {
  // Read the names first: any state change before the reopen records the welcome buffer.
  const { lastOpenedFileName, lastOpenedExternalId } =
    useBufferStore.getState();

  try {
    useBufferStore.setState({ externalFiles: await listExternalFiles() });
  } catch (error) {
    useBufferStore.setState({
      fileError: errorMessage(error, "Unable to load external files."),
    });
  }

  if (lastOpenedExternalId) {
    // Browsers ask again for file access after a reload, which needs a click.
    await openTrackedExternalFile(lastOpenedExternalId).catch(() =>
      useBufferStore.setState({ lastOpenedExternalId: null }),
    );

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
