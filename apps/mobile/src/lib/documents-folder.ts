import { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import { Directory, File, Paths } from "expo-file-system";

import {
  type FileExtension,
  getFileExtension,
  INVALID_FILE_TITLE_CHARACTERS,
} from "@/lib/editor-files";

/** Saved markdown and drawings, in `lunarscribe/` inside the app's Documents folder. */
const folder = new Directory(Paths.document, "lunarscribe");

// Every write goes through one queue, so a save never races a rename or delete.
const queueFileOperation = createOperationQueue();

const FOLDER_KEY = "documents-folder";

/** Replacing slashes keeps every name inside the folder. */
function fileOf(name: string) {
  return new File(folder, name.replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_"));
}

function removeFile(name: string) {
  const file = fileOf(name);

  if (file.exists) {
    file.delete();
  }
}

function ensureFolder() {
  if (!folder.exists) {
    folder.create({ intermediates: true, idempotent: true });
  }
}

/** Saved file names with a supported extension, sorted by name. */
export function listFiles() {
  ensureFolder();

  return folder
    .list()
    .flatMap((entry) =>
      entry instanceof File && getFileExtension(entry.name) !== null
        ? [entry.name]
        : [],
    )
    .sort((left, right) => left.localeCompare(right));
}

export function readFile(name: string) {
  return queueFileOperation(FOLDER_KEY, () => fileOf(name).text());
}

/**
 * Writes `<title><extension>`, removing `previousName` if the title changed. Never
 * overwrites another file: on a clash it uses `<title>_N<extension>`. Returns the
 * name saved under.
 */
export function saveFile(
  previousName: string | null,
  title: string,
  extension: FileExtension,
  content: string,
) {
  return queueFileOperation(FOLDER_KEY, async () => {
    ensureFolder();

    const stem =
      title.trim().replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_") || "untitled";

    let name = `${stem}${extension}`;

    for (
      let suffix = 1;
      name !== previousName && fileOf(name).exists;
      suffix += 1
    ) {
      name = `${stem}_${suffix}${extension}`;
    }

    fileOf(name).write(content);

    if (previousName && previousName !== name) {
      removeFile(previousName);
    }

    return name;
  });
}

export function deleteFile(name: string) {
  return queueFileOperation(FOLDER_KEY, async () => removeFile(name));
}

/** A saved file as sync reads it; `fileTime` is its modification time on this device. */
export type SavedFileRecord = {
  name: string;
  content: string;
  fileTime: number;
};

async function readRecord(name: string): Promise<SavedFileRecord | null> {
  const file = fileOf(name);

  return file.exists
    ? { name, content: await file.text(), fileTime: file.modificationTime ?? 0 }
    : null;
}

/** Every saved file, read inside the queue that processes local saves. */
export function readAllFiles() {
  return queueFileOperation(FOLDER_KEY, async () => {
    const records: SavedFileRecord[] = [];

    for (const name of listFiles()) {
      const record = await readRecord(name);

      if (record) {
        records.push(record);
      }
    }

    return records;
  });
}

/**
 * Writes, or deletes when `content` is null, a file pulled by sync, only if it still
 * matches `snapshot`. Returns null when the file changed in the meantime, otherwise
 * the new modification time (0 once deleted).
 */
export function applySyncedFile(
  name: string,
  snapshot: SavedFileRecord | null,
  content: string | null,
) {
  return queueFileOperation(FOLDER_KEY, async () => {
    const current = await readRecord(name);

    if (
      current?.content !== snapshot?.content ||
      current?.fileTime !== snapshot?.fileTime
    ) {
      return null;
    }

    if (content === null) {
      removeFile(name);

      return 0;
    }

    const file = fileOf(name);

    ensureFolder();
    file.write(content);

    return file.modificationTime ?? 0;
  });
}

/** A saved file whose name or content matches a search query. */
export type FileSearchMatch = { name: string; lineContent?: string };

/** Case-insensitive search over file names, then over each file's lines. */
export async function searchFiles(query: string): Promise<FileSearchMatch[]> {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return [];
  }

  const matches: FileSearchMatch[] = [];

  for (const name of listFiles()) {
    if (name.toLowerCase().includes(needle)) {
      matches.push({ name });

      continue;
    }

    // Drawings are scene JSON; only their names are searchable.
    if (getFileExtension(name) === ".draw") {
      continue;
    }

    const line = (await readFile(name))
      .split("\n")
      .find((candidate) => candidate.toLowerCase().includes(needle));

    if (line !== undefined) {
      matches.push({ name, lineContent: line.trim() });
    }
  }

  return matches;
}
