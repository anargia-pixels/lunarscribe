import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { isImageFileName } from "@lunarscribe/utils/images";
import { isSafeSavedPath, joinSavedPath } from "@lunarscribe/utils/saved-paths";
import type { SavedEntries } from "@lunarscribe/utils/saved-paths";

import { getFileExtension } from "../lib/editor-files";

/** Files the sidebar lists: markdown, drawings, and the images notes embed. */
export function isListedFileName(name: string) {
  return getFileExtension(name) !== null || isImageFileName(name);
}

/** The disk path of a saved file or folder; rejects names that would leave `folder`. */
export function resolveSavedPath(folder: string, name: string) {
  if (!isSafeSavedPath(name)) {
    throw new Error(`The path ${JSON.stringify(name)} is not a saved file.`);
  }

  return join(folder, name);
}

/**
 * Saved files and folders under `folder`, named by their relative paths. Hidden entries,
 * such as `.git`, are skipped, and symlinked folders are never followed. `isListed`
 * picks the files by name: markdown, drawings, and images unless set.
 */
export async function listSavedEntries(
  folder: string,
  isListed = isListedFileName,
): Promise<SavedEntries> {
  const entries: SavedEntries = { files: [], folders: [] };

  async function walk(relative: string) {
    for (const entry of await readdir(join(folder, relative), {
      withFileTypes: true,
    })) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const path = joinSavedPath(relative, entry.name);

      if (entry.isDirectory()) {
        entries.folders.push(path);
        await walk(path);
      } else if (isListed(entry.name)) {
        entries.files.push(path);
      }
    }
  }

  await walk("");

  return entries;
}
