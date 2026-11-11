import {
  getFileExtension,
  stemOf,
  type FileExtension,
  toFileStem,
  isSyncedFileName,
} from "@lunarscribe/utils/file-kinds";
import {
  availableImageName,
  isImageFileName,
  splitImageFileName,
} from "@lunarscribe/utils/images";
import { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import {
  allFolders,
  baseNameOf,
  folderOf,
  isInFolder,
  joinSavedPath,
  replaceFolder,
  toFolderName,
} from "@lunarscribe/utils/saved-paths";
import type { SavedEntries } from "@lunarscribe/utils/saved-paths";
import { isSameSyncContent } from "@lunarscribe/utils/sync/types";
import type { SyncContent } from "@lunarscribe/utils/sync/types";

import {
  deleteRecord,
  getAllNames,
  getAllRecords,
  getRecord,
  putRecord,
  withStore,
} from "@/lib/browser-database";
import type { SavedFileRecord, SavedImageRecord } from "@/lib/browser-database";

/**
 * Saved buffers live in IndexedDB as `<folder>/<title><extension>` records, standing in
 * for the desktop app's Documents/lunarscribe folder; folder records keep empty folders. Other tabs learn about changes through a
 * broadcast channel, the way the desktop app watches the folder.
 */

const queueFileOperation = createOperationQueue();

const QUEUE_KEY = "saved-files";

const listeners = new Set<(entries: SavedEntries) => void>();

const channel = new BroadcastChannel("lunarscribe-saved-files");

async function readRecords() {
  return withStore("files", "readonly", (store) =>
    getAllRecords<"files">(store),
  );
}

async function readFolderNames() {
  return (
    await withStore("folders", "readonly", (store) =>
      getAllRecords<"folders">(store),
    )
  ).map((record) => record.name);
}

/** A saved file's extension, kept when it moves; images keep theirs as written. */
function extensionOf(name: string) {
  return (
    getFileExtension(name) ??
    (isImageFileName(name)
      ? splitImageFileName(baseNameOf(name)).extension
      : "")
  );
}

/** Saved notes, drawings, the images they embed, and folders, named by their paths. */
export async function listFiles(): Promise<SavedEntries> {
  const files = (await readRecords())
    .map((record) => record.name)
    .filter((name) => getFileExtension(name) !== null || isImageFileName(name))
    .sort((left, right) => left.localeCompare(right));

  return {
    files,
    folders: allFolders({ files, folders: await readFolderNames() }),
  };
}

async function emitFilesChanged() {
  const entries = await listFiles();

  for (const listener of listeners) {
    listener(entries);
  }
}

/** Updates listeners in this tab, then tells other tabs to do the same. */
async function notifyFilesChanged() {
  await emitFilesChanged();
  channel.postMessage(null);
}

channel.addEventListener("message", () => void emitFilesChanged());

export function onFilesChanged(listener: (entries: SavedEntries) => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

async function readRecord(name: string) {
  return withStore("files", "readonly", (store) =>
    getRecord<"files">(store, name),
  );
}

export function readFile(name: string) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const record = await readRecord(name);

    if (!record || record.content instanceof Uint8Array) {
      throw new Error(`The saved file "${name}" no longer exists.`);
    }

    return record.content;
  });
}

function isTextRecord(
  record: SavedFileRecord | SavedImageRecord,
): record is SavedFileRecord {
  return !(record.content instanceof Uint8Array);
}

/** Every saved markdown file and drawing with its content and modification time. */
export function readAllFiles() {
  return queueFileOperation(QUEUE_KEY, async () =>
    (await readRecords()).filter(isTextRecord),
  );
}

/** Every synced file (markdown, drawings, and the images they embed), or only `name`. */
export function readSyncedFiles(name: string | null) {
  return queueFileOperation(QUEUE_KEY, async () => {
    if (name === null) {
      return (await readRecords()).filter((record) =>
        isSyncedFileName(record.name),
      );
    }

    const record = await readRecord(name);

    return record ? [record] : [];
  });
}

/** Every saved image path, for resolving embeds. */
export async function listImageNames() {
  const names = await withStore("files", "readonly", getAllNames);

  return names.filter(isImageFileName);
}

/** A saved image's bytes and modification time, or null when it does not exist. */
export async function readImage(name: string) {
  const record = await readRecord(name);

  return record?.content instanceof Uint8Array
    ? { content: record.content, modifiedAt: record.modifiedAt }
    : null;
}

/**
 * Copies images into `folder`, next to the markdown that embeds them, never over another
 * file. Returns the name of each inside `folder`, which is its embed target.
 */
export function saveImages(
  folder: string,
  images: { name: string; content: Uint8Array<ArrayBuffer> }[],
) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const targets = await withStore("files", "readwrite", async (store) => {
      const taken = new Set(await getAllNames(store));

      const saved: string[] = [];

      for (const image of images) {
        const name = availableImageName(folder, image.name, (path) =>
          taken.has(path),
        );

        taken.add(name);
        await putRecord<"files">(store, {
          name,
          content: image.content,
          modifiedAt: Date.now(),
        });
        saved.push(name.slice(folder ? folder.length + 1 : 0));
      }

      return saved;
    });

    await notifyFilesChanged();

    return targets;
  });
}

/** `<stem><extension>` in `folder`, or `<stem>_1<extension>`, ... when another file has it. */
async function availableName(
  store: IDBObjectStore,
  folder: string,
  stem: string,
  extension: string,
  previousName: string | null,
) {
  let candidate = joinSavedPath(folder, `${stem}${extension}`);

  // Never overwrite another file: take `<stem>_1`, `<stem>_2`, ... instead.
  for (
    let suffix = 1;
    candidate !== previousName && (await getRecord<"files">(store, candidate));
    suffix += 1
  ) {
    candidate = joinSavedPath(folder, `${stem}_${suffix}${extension}`);
  }

  return candidate;
}

/**
 * Writes `<title><extension>` in the folder of `previousName`, or in `folder` for a new
 * file, removing `previousName` if the title changed. Never overwrites another file: on a
 * clash it uses `<title>_N<extension>`. Returns the name saved under.
 */
export function saveFile(
  previousName: string | null,
  folder: string,
  title: string,
  extension: FileExtension,
  content: string,
  expectedContent: string | null,
) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const name = await withStore("files", "readwrite", async (store) => {
      if (previousName && expectedContent !== null) {
        const current = await getRecord<"files">(store, previousName);

        if (!current) {
          throw new Error(
            "The saved file was removed. Your buffer is safe; copy your writing before reopening the saved file.",
          );
        }

        if (current.content !== expectedContent) {
          throw new Error(
            "The saved file changed since this buffer was loaded. Your edits were preserved. Copy your writing before reopening the saved file to resolve the conflict.",
          );
        }
      }

      const stem = toFileStem(title) || "untitled";

      const candidate = await availableName(
        store,
        previousName === null ? folder : folderOf(previousName),
        stem,
        extension,
        previousName,
      );

      await putRecord<"files">(store, {
        name: candidate,
        content,
        modifiedAt: Date.now(),
      });

      if (previousName && previousName !== candidate) {
        await deleteRecord(store, previousName);
      }

      return candidate;
    });

    await notifyFilesChanged();

    return name;
  });
}

/** Moves a saved file into `folder` (`""` for the top level); returns its new name. */
export function moveFile(name: string, folder: string) {
  return queueFileOperation(QUEUE_KEY, async () => {
    if (folderOf(name) === folder) {
      return name;
    }

    const moved = await withStore("files", "readwrite", async (store) => {
      const record = await getRecord<"files">(store, name);

      if (!record) {
        throw new Error(`The saved file "${name}" no longer exists.`);
      }

      const candidate = await availableName(
        store,
        folder,
        stemOf(name),
        extensionOf(name),
        null,
      );

      await putRecord<"files">(store, { ...record, name: candidate });
      await deleteRecord(store, name);

      return candidate;
    });

    await notifyFilesChanged();

    return moved;
  });
}

/** Renames a saved image to `<title><its extension>` in its folder; returns its new name. */
export function renameImage(name: string, title: string) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const stem = toFileStem(title);

    if (!stem || stem.startsWith(".")) {
      throw new Error("Enter a name for the image.");
    }

    const renamed = await withStore("files", "readwrite", async (store) => {
      const record = await getRecord<"files">(store, name);

      if (!record) {
        throw new Error(`The saved image "${name}" no longer exists.`);
      }

      const candidate = await availableName(
        store,
        folderOf(name),
        stem,
        extensionOf(name),
        name,
      );

      if (candidate !== name) {
        await putRecord<"files">(store, { ...record, name: candidate });
        await deleteRecord(store, name);
      }

      return candidate;
    });

    await notifyFilesChanged();

    return renamed;
  });
}

/** A folder path no file or folder uses yet, so creating or renaming never merges two. */
async function assertNewFolder(path: string) {
  const { files, folders } = await listFiles();

  if (folders.includes(path) || files.some((name) => isInFolder(name, path))) {
    throw new Error(`A file or folder named “${baseNameOf(path)}” exists.`);
  }
}

/** Creates a folder named `input` inside `parent`; returns its path. */
export function createFolder(parent: string, input: string) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const path = joinSavedPath(parent, toFolderName(input));

    await assertNewFolder(path);
    await withStore("folders", "readwrite", (store) =>
      putRecord<"folders">(store, { name: path }),
    );
    await notifyFilesChanged();

    return path;
  });
}

/** Renames a folder with everything inside it; returns its new path. */
export function renameFolder(path: string, input: string) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const renamed = joinSavedPath(folderOf(path), toFolderName(input));

    if (renamed === path) {
      return path;
    }

    await assertNewFolder(renamed);

    // Folder records first, so a failure leaves files where they were.
    await withStore("folders", "readwrite", async (store) => {
      for (const record of await getAllRecords<"folders">(store)) {
        if (isInFolder(record.name, path)) {
          await deleteRecord(store, record.name);
          await putRecord<"folders">(store, {
            name: replaceFolder(record.name, path, renamed),
          });
        }
      }

      // A folder known only from its files' paths gets a record of its own.
      await putRecord<"folders">(store, { name: renamed });
    });
    await withStore("files", "readwrite", async (store) => {
      for (const record of await getAllRecords<"files">(store)) {
        if (isInFolder(record.name, path)) {
          await putRecord<"files">(store, {
            ...record,
            name: replaceFolder(record.name, path, renamed),
          });
          await deleteRecord(store, record.name);
        }
      }
    });

    await notifyFilesChanged();

    return renamed;
  });
}

/** Deletes a folder and everything inside it. */
export function deleteFolder(path: string) {
  return queueFileOperation(QUEUE_KEY, async () => {
    await withStore("files", "readwrite", async (store) => {
      for (const record of await getAllRecords<"files">(store)) {
        if (isInFolder(record.name, path)) {
          await deleteRecord(store, record.name);
        }
      }
    });
    await withStore("folders", "readwrite", async (store) => {
      for (const record of await getAllRecords<"folders">(store)) {
        if (isInFolder(record.name, path)) {
          await deleteRecord(store, record.name);
        }
      }
    });
    await notifyFilesChanged();
  });
}

export function deleteFile(name: string) {
  return queueFileOperation(QUEUE_KEY, async () => {
    await withStore("files", "readwrite", (store) => deleteRecord(store, name));
    await notifyFilesChanged();
  });
}

/**
 * Applies a sync pull only when the stored copy still matches the snapshot the sync
 * compared against; returns false when the local file changed in the meantime.
 */
export function applySyncedFile(
  name: string,
  snapshot: SavedFileRecord | SavedImageRecord | null,
  content: SyncContent | null,
  modifiedAt: number,
) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const isApplied = await withStore("files", "readwrite", async (store) => {
      const current = (await getRecord<"files">(store, name)) ?? null;

      if (
        !isSameSyncContent(current?.content, snapshot?.content) ||
        current?.modifiedAt !== snapshot?.modifiedAt
      ) {
        return false;
      }

      if (content === null) {
        await deleteRecord(store, name);
      } else {
        // The branches match; each narrows `content` to one record type.
        await putRecord<"files">(
          store,
          content instanceof Uint8Array
            ? { name, content, modifiedAt }
            : { name, content, modifiedAt },
        );
      }

      return true;
    });

    if (isApplied) {
      await notifyFilesChanged();
    }

    return isApplied;
  });
}
