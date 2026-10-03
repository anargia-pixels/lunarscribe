import { basename } from "node:path";

import { getFileExtension } from "../../lib/editor-files";
import { jsonArray, jsonField, jsonString, parseJson } from "./json";
import type { FileSyncProvider, RemoteFiles } from "./provider";
import { SyncSignInRequired } from "./provider";

const API = "https://www.googleapis.com/drive/v2/files";

type DriveFile = { id: string; title: string; etag: string; mimeType: string };

/** v2 exposes metadata ETags for conditional updates and trash operations. */
export function createGoogleDriveApi(accessToken: () => Promise<string>) {
  async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${await accessToken()}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 412) {
      throw new Error(
        "Google Drive changed on another device. The remote file was preserved; retry sync.",
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

  async function list(query: string) {
    const files: DriveFile[] = [];
    let pageToken = "";

    do {
      const parameters = new URLSearchParams({
        q: query,
        maxResults: "1000",
        fields: "items(id,title,etag,mimeType),nextPageToken",
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
          });
        }
      }

      pageToken = jsonString(page, "nextPageToken", true);
    } while (pageToken);

    return files;
  }

  async function folder() {
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

  function provider(folderId: string): FileSyncProvider {
    const identities = new Map<string, DriveFile>();

    return {
      async read() {
        identities.clear();
        const files: RemoteFiles = new Map();

        for (const file of await list(
          `'${folderId}' in parents and trashed = false`,
        )) {
          if (
            file.title !== basename(file.title) ||
            !getFileExtension(file.title)
          ) {
            continue;
          }

          if (files.has(file.title)) {
            throw new Error(
              `Google Drive contains multiple versions of ${file.title}. Both copies were preserved; resolve the duplicate before syncing.`,
            );
          }

          if (file.mimeType.startsWith("application/vnd.google-apps.")) {
            files.set(file.title, {
              content: "",
              revision: file.etag,
              blocked: true,
            });

            continue;
          }

          const response = await request(
            `${API}/${encodeURIComponent(file.id)}?alt=media`,
            { headers: { "If-Match": file.etag } },
          );

          const content = await response.text();

          const current = parseJson(
            await (
              await request(
                `${API}/${encodeURIComponent(file.id)}?fields=id,title,etag,mimeType`,
              )
            ).text(),
          );

          if (jsonString(current, "etag") !== file.etag) {
            throw new Error(
              `Google Drive changed ${file.title} while it was being read. Retry sync.`,
            );
          }

          identities.set(file.title, file);
          files.set(file.title, { content, revision: file.etag });
        }

        return files;
      },
      async write(changes, snapshot) {
        for (const change of changes) {
          const file = identities.get(change.name);

          if (file && !snapshot.get(change.name)?.revision) {
            throw new Error(
              "The Google Drive sync snapshot is incomplete. Retry sync.",
            );
          }

          if (change.content === null) {
            if (file) {
              await request(`${API}/${encodeURIComponent(file.id)}/trash`, {
                method: "POST",
                headers: { "If-Match": file.etag },
              });
            }

            continue;
          }

          if (file) {
            await request(
              `https://www.googleapis.com/upload/drive/v2/files/${encodeURIComponent(file.id)}?uploadType=media`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/octet-stream",
                  "If-Match": file.etag,
                },
                body: change.content,
              },
            );
          } else {
            // Duplicate names created concurrently remain separate copies, never overwrites.
            const boundary = `lunarscribe-${crypto.randomUUID()}`;

            const metadata = {
              title: change.name,
              parents: [{ id: folderId }],
            };

            await request(
              "https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart",
              {
                method: "POST",
                headers: {
                  "Content-Type": `multipart/related; boundary=${boundary}`,
                },
                body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${change.content}\r\n--${boundary}--`,
              },
            );
          }
        }
      },
    };
  }

  async function account() {
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

  return { folder, provider, account };
}
