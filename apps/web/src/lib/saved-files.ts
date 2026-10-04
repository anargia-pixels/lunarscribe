import { createOperationQueue } from "@lunarscribe/utils/operation-queue";

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
} from "@/lib/editor-files";
import type { FileExtension } from "@/lib/editor-files";

/**
 * Saved buffers live in IndexedDB as `<title><extension>` records, standing in for the
 * desktop app's Documents/lunarscribe folder. Other tabs learn about changes through a
 * broadcast channel, the way the desktop app watches the folder.
 */

const queueFileOperation = createOperationQueue();

const QUEUE_KEY = "saved-files";

const listeners = new Set<(files: string[]) => void>();

const channel = new BroadcastChannel("lunarscribe-saved-files");

async function readRecords() {
  return withStore("files", "readonly", (store) =>
    getAllRecords<"files">(store),
  );
}

export async function listFiles() {
  return (await readRecords())
    .map((record) => record.name)
    .filter((name) => getFileExtension(name) !== null)
    .sort((left, right) => left.localeCompare(right));
}

async function emitFilesChanged() {
  const files = await listFiles();

  for (const listener of listeners) {
    listener(files);
  }
}

/** Updates listeners in this tab, then tells other tabs to do the same. */
async function notifyFilesChanged() {
  await emitFilesChanged();
  channel.postMessage(null);
}

channel.addEventListener("message", () => void emitFilesChanged());

export function onFilesChanged(listener: (files: string[]) => void) {
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

/**
 * Writes `<title><extension>`, removing `previousName` if the title changed. Never
 * overwrites another file: on a clash it uses `<title>_N<extension>`. Returns the name saved under.
 */
export function saveFile(
  previousName: string | null,
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

      let candidate = `${stem}${extension}`;

      // Never overwrite another file: take `<stem>_1`, `<stem>_2`, ... instead.
      for (
        let suffix = 1;
        candidate !== previousName &&
        (await getRecord<"files">(store, candidate));
        suffix += 1
      ) {
        candidate = `${stem}_${suffix}${extension}`;
      }

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
