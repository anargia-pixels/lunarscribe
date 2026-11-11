import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import { isSyncedFileName } from "@lunarscribe/utils/file-kinds";
import { isImageFileName } from "@lunarscribe/utils/images";
import type { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import { toTextChange } from "@lunarscribe/utils/sync/plan";
import type {
  LocalSyncFile,
  LocalSyncFiles,
  LocalSyncStore,
} from "@lunarscribe/utils/sync/plan";
import { isSameSyncContent } from "@lunarscribe/utils/sync/types";
import type {
  RemoteChange,
  SyncContent,
  SyncedFileChange,
} from "@lunarscribe/utils/sync/types";

import { listSavedEntries } from "../saved-path";

// Reading
/** Read a synced file as text, or as bytes for an image. */
async function readSyncContent(path: string): Promise<SyncContent> {
  return isImageFileName(path)
    ? new Uint8Array(await readFile(path))
    : readFile(path, "utf8");
}

/** One saved file as sync compares it, or null when it does not exist. */
async function readLocalFile(
  folder: string,
  name: string,
): Promise<LocalSyncFile | null> {
  const path = join(folder, name);
  let metadata: Awaited<ReturnType<typeof lstat>>;

  try {
    metadata = await lstat(path);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
      return null;
    }

    throw cause;
  }

  return metadata.isFile()
    ? { content: await readSyncContent(path), modifiedAt: metadata.mtimeMs }
    : { content: "", modifiedAt: metadata.mtimeMs, blocked: true };
}

/** Every synced file, or only `name`; links and folders come back as blocked. */
export async function readLocalSyncFiles(
  folder: string,
  name: string | null,
): Promise<LocalSyncFiles> {
  const names =
    name === null
      ? (await listSavedEntries(folder, isSyncedFileName)).files
      : [name];

  const files: LocalSyncFiles = new Map();

  for (const candidate of names) {
    const file = await readLocalFile(folder, candidate);

    if (file) {
      files.set(candidate, file);
    }
  }

  return files;
}

// Writing
/** Write a pulled file through a temporary copy, or remove it when its content is null. */
export async function writeSavedFile(folder: string, change: RemoteChange) {
  const path = join(folder, change.name);

  if (change.content === null) {
    await rm(path, { force: true });

    return;
  }

  const temporaryPath = join(folder, `.sync-${crypto.randomUUID()}`);

  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporaryPath, change.content, {
      flag: "wx",
      mode: 0o600,
    });
    const modifiedAt = new Date(change.modifiedAt);
    await utimes(temporaryPath, modifiedAt, modifiedAt);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

/** Cloud sync's access to the documents folder, inside its save queue. */
export function createLocalSyncStore(
  folder: string,
  queue: ReturnType<typeof createOperationQueue>,
): LocalSyncStore {
  return {
    read: (name) => queue(folder, () => readLocalSyncFiles(folder, name)),
    apply: (change, before) =>
      queue(folder, async () => {
        const current = await readLocalFile(folder, change.name);

        if (
          current?.blocked ||
          !isSameSyncContent(before?.content, current?.content) ||
          before?.modifiedAt !== current?.modifiedAt
        ) {
          return false;
        }

        await writeSavedFile(folder, change);

        return true;
      }),
  };
}

// Git changes
/** Return disk changes so clean buffers can reload after a Git merge. */
export function getFileChanges(before: LocalSyncFiles, after: LocalSyncFiles) {
  const changes: SyncedFileChange[] = [];

  const contentOf = (file: LocalSyncFile | undefined) =>
    file && !file.blocked ? file.content : null;

  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const oldContent = contentOf(before.get(name));
    const newContent = contentOf(after.get(name));
    const change = toTextChange(name, oldContent, newContent);

    if (change && oldContent !== newContent) changes.push(change);
  }

  return changes;
}

/** A saved file's text, or null when it does not exist. */
export async function readSavedText(folder: string, name: string) {
  try {
    return await readFile(join(folder, name), "utf8");
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
      return null;
    }

    throw cause;
  }
}
