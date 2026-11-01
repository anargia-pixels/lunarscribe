import { createHash } from "node:crypto";

import { mapConcurrent } from "@lunarscribe/utils/map-concurrent";
import { baseNameOf, folderOf } from "@lunarscribe/utils/saved-paths";
import {
  createDriveTree,
  DRIVE_FOLDER_TYPE,
  driveQueryString,
} from "@lunarscribe/utils/sync/google-drive-tree";
import type { DriveTreeFile } from "@lunarscribe/utils/sync/google-drive-tree";
import {
  jsonArray,
  jsonField,
  jsonString,
  jsonTimestamp,
  parseJson,
} from "@lunarscribe/utils/sync/json";
import type {
  FileSyncProvider,
  RemoteFiles,
} from "@lunarscribe/utils/sync/types";
import {
  SYNC_CONCURRENCY,
  SyncSignInRequired,
} from "@lunarscribe/utils/sync/types";

import { isSavedFileName } from "../files";

// Drive metadata
const API = "https://www.googleapis.com/drive/v2/files";

type DriveFile = {
  id: string;
  title: string;
  etag: string;
  mimeType: string;
  md5Checksum: string;
  modifiedAt: number;
};

/** v2 exposes metadata ETags for conditional updates and trash operations. */
export function createGoogleDriveApi(accessToken: () => Promise<string>) {
  /** Report request failures without exposing remote response bodies. */
  async function request(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${await accessToken()}`);

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 412) {
      throw new Error(
        "Google Drive no longer matches the sync snapshot. The remote file was preserved; retry sync.",
      );
    }

    if (response.status === 401) {
      throw new SyncSignInRequired(
        "Google Drive needs sign-in again. Open Settings → Syncing and select Sign in again.",
      );
    }

    if (!response.ok) {
      throw new Error(
        `Google Drive request failed (${response.status}). Check your connection and account access, then retry.`,
      );
    }

    return response;
  }

  /** Read all metadata pages before comparing remote file versions. */
  async function list(query: string) {
    const files: DriveFile[] = [];
    let pageToken = "";

    do {
      const parameters = new URLSearchParams({
        q: query,
        maxResults: "1000",
        fields:
          "items(id,title,etag,mimeType,md5Checksum,modifiedDate),nextPageToken",
        pageToken,
      });

      const page = parseJson(
        await (await request(`${API}?${parameters}`)).text(),
      );

      if (jsonField(page, "items") !== undefined) {
        for (const metadata of jsonArray(page, "items")) {
          files.push({
            id: jsonString(metadata, "id"),
            title: jsonString(metadata, "title"),
            etag: jsonString(metadata, "etag"),
            mimeType: jsonString(metadata, "mimeType"),
            md5Checksum: jsonString(metadata, "md5Checksum", true),
            modifiedAt: jsonTimestamp(metadata, "modifiedDate"),
          });
        }
      }

      pageToken = jsonString(page, "nextPageToken", true);
    } while (pageToken);

    return files;
  }

  /** Use one app-owned backup folder; reject duplicate destinations. */
  async function getOrCreateFolder() {
    const folders = await list(
      "title = 'lunarscribe-bak-files' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'me' in owners",
    );

    if (folders.length > 1) {
      throw new Error(
        "More than one lunarscribe-bak-files folder exists in Google Drive. Keep one backup folder and reconnect.",
      );
    }

    if (folders[0]) {
      return folders[0].id;
    }

    const createdFolder = parseJson(
      await (
        await request(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "lunarscribe-bak-files",
            mimeType: "application/vnd.google-apps.folder",
          }),
        })
      ).text(),
    );

    return jsonString(createdFolder, "id");
  }

  /** Keep remote IDs and revisions in the snapshot used for each write. */
  function createProvider(folderId: string): FileSyncProvider {
    const tree = createDriveTree(folderId, {
      list,
      async createFolder(title, parentId) {
        const created = parseJson(
          await (
            await request(`${API}?fields=id`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                mimeType: DRIVE_FOLDER_TYPE,
                parents: [{ id: parentId }],
              }),
            })
          ).text(),
        );

        return jsonString(created, "id");
      },
      // Keeps the modification time, so the move alone never reads as an edit.
      async move(file, fromId, toId, title) {
        const parameters = new URLSearchParams({
          addParents: toId,
          removeParents: fromId,
          setModifiedDate: "true",
          fields: "etag",
        });

        const moved = parseJson(
          await (
            await request(
              `${API}/${encodeURIComponent(file.id)}?${parameters}`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "If-Match": file.etag,
                },
                body: JSON.stringify({
                  title,
                  modifiedDate: new Date(file.modifiedAt).toISOString(),
                }),
              },
            )
          ).text(),
        );

        return { ...file, title, etag: jsonString(moved, "etag") };
      },
    });

    async function upload(
      name: string,
      content: string,
      modifiedAt: number,
      id?: string,
      revision?: string,
    ) {
      const boundary = `lunarscribe-${crypto.randomUUID()}`;

      const modification = {
        modifiedDate: new Date(modifiedAt).toISOString(),
      };

      const metadata = id
        ? modification
        : {
            title: baseNameOf(name),
            parents: [{ id: await tree.folderId(folderOf(name)) }],
          };

      const headers = new Headers({
        "Content-Type": `multipart/related; boundary=${boundary}`,
      });

      if (revision) headers.set("If-Match", revision);

      const url = id
        ? `https://www.googleapis.com/upload/drive/v2/files/${encodeURIComponent(id)}?uploadType=multipart&setModifiedDate=true`
        : "https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&fields=id,etag";

      const uploaded = await request(url, {
        method: id ? "PUT" : "POST",
        headers,
        body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${content}\r\n--${boundary}--`,
      });

      if (!id) {
        const created = parseJson(await uploaded.text());

        // Drive accepts the original modification time only on an update.
        await request(
          `${API}/${encodeURIComponent(jsonString(created, "id"))}?setModifiedDate=true`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "If-Match": jsonString(created, "etag"),
            },
            body: JSON.stringify(modification),
          },
        );
      }
    }

    return {
      /** Verify downloaded bytes before acknowledging a remote version. */
      async read(name) {
        const files: RemoteFiles = new Map();
        const downloads: DriveTreeFile<DriveFile>[] = [];

        for (const file of await tree.list()) {
          if (
            !isSavedFileName(file.path) ||
            (name !== null && file.path !== name)
          ) {
            continue;
          }

          if (files.has(file.path)) {
            throw new Error(
              `Google Drive contains multiple versions of ${JSON.stringify(file.path)}. Both copies were preserved; resolve the duplicate before syncing.`,
            );
          }

          // Reserve the name so a duplicate is caught before any download.
          files.set(file.path, {
            content: "",
            revision: file.etag,
            modifiedAt: file.modifiedAt,
            modifiedAtPrecisionMs: 1,
            blocked: true,
          });

          if (!file.mimeType.startsWith("application/vnd.google-apps.")) {
            downloads.push(file);
          }
        }

        // The checksum ties the bytes to the listed ETag; writes recheck it with If-Match.
        await mapConcurrent(downloads, SYNC_CONCURRENCY, async (file) => {
          const response = await request(
            `${API}/${encodeURIComponent(file.id)}?alt=media`,
          );

          const bytes = Buffer.from(await response.arrayBuffer());

          if (
            !file.md5Checksum ||
            createHash("md5").update(bytes).digest("hex") !== file.md5Checksum
          ) {
            throw new Error(
              `Google Drive could not verify ${JSON.stringify(file.path)} against the sync snapshot. The local and remote files were preserved; retry sync.`,
            );
          }

          const content = bytes.toString("utf8");

          files.set(file.path, {
            id: file.id,
            content,
            revision: file.etag,
            modifiedAt: file.modifiedAt,
            modifiedAtPrecisionMs: 1,
          });
        });

        return files;
      },
      /** Use the snapshot revision to reject concurrent remote changes. */
      async write(changes, snapshot) {
        await mapConcurrent(changes, SYNC_CONCURRENCY, async (change) => {
          const file = snapshot.get(change.name);
          const id = file?.id;

          if (file && (!id || !file.revision)) {
            throw new Error(
              "The Google Drive sync snapshot is incomplete. Retry sync.",
            );
          }

          if (change.content === null) {
            if (file && id) {
              await request(`${API}/${encodeURIComponent(id)}/trash`, {
                method: "POST",
                headers: { "If-Match": file.revision },
              });
            }

            return;
          }

          await upload(
            change.name,
            change.content,
            change.modifiedAt,
            id,
            file?.revision,
          );
        });
      },
      async forceWrite(name, content, modifiedAt) {
        const parentId = await tree.folderId(folderOf(name));

        const files = await list(
          `${driveQueryString(parentId)} in parents and title = ${driveQueryString(baseNameOf(name))} and trashed = false`,
        );

        if (files.some((file) => file.mimeType === DRIVE_FOLDER_TYPE)) {
          throw new Error(
            "Google Drive has a folder at this path. Rename it before replacing the remote copy.",
          );
        }

        const copy = files.find(
          (file) => !file.mimeType.startsWith("application/vnd.google-apps."),
        );

        await upload(name, content, modifiedAt, copy?.id);

        // Keep one overwritten copy so duplicate names no longer block sync.
        for (const file of files) {
          if (file.id === copy?.id) continue;

          await request(`${API}/${encodeURIComponent(file.id)}/trash`, {
            method: "POST",
          });
        }
      },
    };
  }

  async function getAccountEmail() {
    const profile = parseJson(
      await (
        await request(
          "https://www.googleapis.com/drive/v2/about?fields=user(emailAddress)",
        )
      ).text(),
    );

    const user = jsonField(profile, "user");

    if (user === undefined) {
      throw new Error("Google Drive did not identify the signed-in account.");
    }

    return jsonString(user, "emailAddress");
  }

  return { getOrCreateFolder, createProvider, getAccountEmail };
}
