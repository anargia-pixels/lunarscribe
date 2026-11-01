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

import {
  deleteRecord,
  getAllRecords,
  getRecord,
  putRecord,
  withStore,
} from "@/lib/browser-database";
import type { SavedFileRecord } from "@/lib/browser-database";
import {
  getFileExtension,
  INVALID_FILE_TITLE_CHARACTERS,
  stemOf,
} from "@/lib/editor-files";
import type { FileExtension } from "@/lib/editor-files";

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

/** Saved files and folders, named by their paths. */
export async function listFiles(): Promise<SavedEntries> {
  const files = (await readRecords())
    .map((record) => record.name)
    .filter((name) => getFileExtension(name) !== null)
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

    if (!record) {
      throw new Error(`The saved file "${name}" no longer exists.`);
    }

    return record.content;
  });
}

/** Every saved file with its content and modification time, for search and sync. */
export function readAllFiles() {
  return queueFileOperation(QUEUE_KEY, readRecords);
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

      const stem =
        title.trim().replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_") ||
        "untitled";

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
        getFileExtension(name) ?? "",
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
  snapshot: SavedFileRecord | null,
  content: string | null,
  modifiedAt: number,
) {
  return queueFileOperation(QUEUE_KEY, async () => {
    const isApplied = await withStore("files", "readwrite", async (store) => {
      const current = (await getRecord<"files">(store, name)) ?? null;

      if (
        current?.content !== snapshot?.content ||
        current?.modifiedAt !== snapshot?.modifiedAt
      ) {
        return false;
      }

      if (content === null) {
        await deleteRecord(store, name);
      } else {
        await putRecord<"files">(store, { name, content, modifiedAt });
      }

      return true;
    });

    if (isApplied) {
      await notifyFilesChanged();
    }

    return isApplied;
  });
}
