import { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import {
  baseNameOf,
  folderOf,
  isSafeSavedPath,
  joinSavedPath,
  toFolderName,
} from "@lunarscribe/utils/saved-paths";
import type { SavedEntries } from "@lunarscribe/utils/saved-paths";
import { Directory, File, Paths } from "expo-file-system";

import {
  type FileExtension,
  getFileExtension,
  INVALID_FILE_TITLE_CHARACTERS,
  stemOf,
} from "@/lib/editor-files";

/** Saved markdown and drawings, in `lunarscribe/` inside the app's Documents folder. */
const folder = new Directory(Paths.document, "lunarscribe");

// Every write goes through one queue, so a save never races a rename or delete.
const queueFileOperation = createOperationQueue();

const FOLDER_KEY = "documents-folder";

/** The parts of a saved path; rejects paths that would leave the folder. */
function partsOf(name: string) {
  if (!isSafeSavedPath(name)) {
    throw new Error(`The path ${JSON.stringify(name)} is not a saved file.`);
  }

  return name.split("/");
}

function fileOf(name: string) {
  return new File(folder, ...partsOf(name));
}

function directoryOf(path: string) {
  return path ? new Directory(folder, ...partsOf(path)) : folder;
}

/** Creates the folder that will hold `name`, with any folders above it. */
function ensureParent(name: string) {
  const parent = directoryOf(folderOf(name));

  if (!parent.exists) {
    parent.create({ intermediates: true, idempotent: true });
  }
}

/** `<stem><extension>` in `parent`, or `<stem>_1<extension>`, ... when another file has it. */
function availableName(
  parent: string,
  stem: string,
  extension: string,
  previousName: string | null,
) {
  let name = joinSavedPath(parent, `${stem}${extension}`);

  for (
    let suffix = 1;
    name !== previousName && fileOf(name).exists;
    suffix += 1
  ) {
    name = joinSavedPath(parent, `${stem}_${suffix}${extension}`);
  }

  return name;
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

/** Saved files and folders, named by their paths and sorted; hidden entries are skipped. */
export function listEntries(): SavedEntries {
  ensureFolder();

  const entries: SavedEntries = { files: [], folders: [] };

  function walk(directory: Directory, relative: string) {
    for (const entry of directory.list()) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const path = joinSavedPath(relative, entry.name);

      if (entry instanceof Directory) {
        entries.folders.push(path);
        walk(entry, path);
      } else if (getFileExtension(entry.name) !== null) {
        entries.files.push(path);
      }
    }
  }

  walk(folder, "");
  entries.files.sort((left, right) => left.localeCompare(right));
  entries.folders.sort((left, right) => left.localeCompare(right));

  return entries;
}

/** Saved file paths with a supported extension, sorted. */
export function listFiles() {
  return listEntries().files;
}

export function readFile(name: string) {
  return queueFileOperation(FOLDER_KEY, () => fileOf(name).text());
}

/**
 * Writes `<title><extension>` in the folder of `previousName`, or in `parent` for a new
 * file, removing `previousName` if the title changed. Never overwrites another file: on
 * a clash it uses `<title>_N<extension>`. Returns the name saved under.
 */
export function saveFile(
  previousName: string | null,
  parent: string,
  title: string,
  extension: FileExtension,
  content: string,
) {
  return queueFileOperation(FOLDER_KEY, async () => {
    ensureFolder();

    const stem =
      title.trim().replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_") || "untitled";

    const name = availableName(
      previousName === null ? parent : folderOf(previousName),
      stem,
      extension,
      previousName,
    );

    ensureParent(name);
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

/** Moves a saved file into `parent` (`""` for the top level); returns its new name. */
export function moveFile(name: string, parent: string) {
  return queueFileOperation(FOLDER_KEY, async () => {
    if (folderOf(name) === parent) {
      return name;
    }

    const moved = availableName(
      parent,
      stemOf(name),
      getFileExtension(name) ?? "",
      null,
    );

    ensureParent(moved);
    await fileOf(name).move(fileOf(moved));

    return moved;
  });
}

/** A folder path nothing uses yet, so creating or renaming never merges two. */
function assertNewFolder(path: string) {
  if (directoryOf(path).exists || fileOf(path).exists) {
    throw new Error(`A file or folder named “${baseNameOf(path)}” exists.`);
  }
}

/** Creates a folder named `input` inside `parent`; returns its path. */
export function createFolder(parent: string, input: string) {
  return queueFileOperation(FOLDER_KEY, async () => {
    const path = joinSavedPath(parent, toFolderName(input));

    assertNewFolder(path);
    directoryOf(path).create({ intermediates: true });

    return path;
  });
}

/** Renames a folder in place; returns its new path. */
export function renameFolder(path: string, input: string) {
  return queueFileOperation(FOLDER_KEY, async () => {
    const name = toFolderName(input);
    const renamed = joinSavedPath(folderOf(path), name);

    if (renamed === path) {
      return path;
    }

    assertNewFolder(renamed);
    directoryOf(path).rename(name);

    return renamed;
  });
}

/** Deletes a folder and everything inside it. */
export function deleteFolder(path: string) {
  return queueFileOperation(FOLDER_KEY, async () => {
    const directory = directoryOf(path);

    if (directory.exists) {
      directory.delete();
    }
  });
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

    ensureParent(name);
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
