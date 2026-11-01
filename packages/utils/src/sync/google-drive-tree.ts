import { mapConcurrent } from "../map-concurrent";
import {
  baseNameOf,
  folderOf,
  isSafeSavedPath,
  joinSavedPath,
} from "../saved-paths";
import { SYNC_CONCURRENCY } from "./types";

export const DRIVE_FOLDER_TYPE = "application/vnd.google-apps.folder";

type DriveItem = { id: string; title: string; mimeType: string };

/** A file in the backup folder tree, named by its saved path. */
export type DriveTreeFile<T extends DriveItem> = T & { path: string };

/** The Drive calls the folder tree needs; each app wires its own authorized requests. */
export type DriveTreeApi<T extends DriveItem> = {
  list: (query: string) => Promise<T[]>;
  createFolder: (title: string, parentId: string) => Promise<string>;
  /** Moves `item` from `fromId` into `toId` as `title` and returns its new metadata. */
  move: (item: T, fromId: string, toId: string, title: string) => Promise<T>;
};

/** Quotes `value` for a Drive search query. */
export function driveQueryString(value: string) {
  return `'${value.replaceAll(/['\\]/gu, "\\$&")}'`;
}

/** Whether a Drive folder title can be a saved folder name. */
function isFolderName(title: string) {
  return !title.includes("/") && isSafeSavedPath(title);
}

/**
 * Saved folders as real Drive folders under the backup folder `rootId`. Earlier versions
 * kept every file in the backup folder with its path as the title; `list` moves those
 * into their folders.
 */
export function createDriveTree<T extends DriveItem>(
  rootId: string,
  api: DriveTreeApi<T>,
) {
  // Promises, so concurrent uploads into a new folder create it once.
  const folderIds = new Map<string, Promise<string>>([
    ["", Promise.resolve(rootId)],
  ]);

  /** The Drive ID of the saved folder at `path`, created with its parents when missing. */
  function folderId(path: string): Promise<string> {
    const known = folderIds.get(path);

    if (known) {
      return known;
    }

    const id = (async () => {
      const parentId = await folderId(folderOf(path));
      const title = baseNameOf(path);

      const [existing] = await api.list(
        `${driveQueryString(parentId)} in parents and title = ${driveQueryString(title)} and mimeType = '${DRIVE_FOLDER_TYPE}' and trashed = false`,
      );

      return existing?.id ?? api.createFolder(title, parentId);
    })();

    folderIds.set(path, id);
    // A failed lookup is retried on the next call.
    id.catch(() => folderIds.delete(path));

    return id;
  }

  /** Every file under the backup folder, walking its folders level by level. */
  async function list() {
    const files: DriveTreeFile<T>[] = [];
    const legacy: { item: T; path: string }[] = [];
    let level = [{ id: rootId, path: "" }];

    while (level.length > 0) {
      const children = await mapConcurrent(
        level,
        SYNC_CONCURRENCY,
        async (folder) => ({
          folder,
          items: await api.list(
            `${driveQueryString(folder.id)} in parents and trashed = false`,
          ),
        }),
      );

      level = [];

      for (const { folder, items } of children) {
        for (const item of items) {
          const path = joinSavedPath(folder.path, item.title);

          if (item.mimeType === DRIVE_FOLDER_TYPE) {
            if (isFolderName(item.title)) {
              // Same-named folders merge; new files go into the first.
              if (!folderIds.has(path)) {
                folderIds.set(path, Promise.resolve(item.id));
              }

              level.push({ id: item.id, path });
            }
          } else if (!item.title.includes("/")) {
            files.push({ ...item, path });
          } else if (folder.path === "") {
            legacy.push({ item, path });
          }
        }
      }
    }

    const paths = new Set(files.map((file) => file.path));

    await mapConcurrent(legacy, SYNC_CONCURRENCY, async ({ item, path }) => {
      // A copy already in place is a duplicate; listing both lets sync report it.
      if (paths.has(path) || !isSafeSavedPath(path)) {
        files.push({ ...item, path });

        return;
      }

      const moved = await api.move(
        item,
        rootId,
        await folderId(folderOf(path)),
        baseNameOf(path),
      );

      files.push({ ...moved, path });
    });

    return files;
  }

  return { list, folderId };
}
