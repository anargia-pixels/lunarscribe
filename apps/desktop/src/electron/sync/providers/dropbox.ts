import { isSavedFileName } from "../files";
import {
  jsonArray,
  jsonBoolean,
  jsonString,
  jsonTimestamp,
  parseJson,
} from "../json";
import type { FileSyncProvider, RemoteFiles } from "./types";
import { SyncSignInRequired } from "./types";

// Dropbox destination
const BACKUP_FOLDER_PATH = "/lunarscribe-bak-files";

type WriteMode =
  | { ".tag": "add" | "overwrite" }
  | { ".tag": "update"; update: string };

/** Access only the Dropbox App folder with the current account token. */
export function createDropboxApi(accessToken: () => Promise<string>) {
  /** Return raw status so folder setup can distinguish a missing path. */
  async function request(route: string, options: RequestInit, content = false) {
    const response = await fetch(
      `https://${content ? "content" : "api"}.dropboxapi.com/2/${route}`,
      {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${await accessToken()}`,
        },
        signal: AbortSignal.timeout(30_000),
      },
    );

    return response;
  }

  /** Send metadata requests as JSON through the same authenticated client. */
  async function rpc(route: string, body: string) {
    return request(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  /** Report status failures without exposing remote response bodies. */
  function checkResponse(response: Response) {
    if (response.status === 401) {
      throw new SyncSignInRequired(
        "Dropbox needs sign-in again. Open Settings → Syncing and select Sign in again.",
      );
    }

    if (!response.ok) {
      throw new Error(
        response.status === 409
          ? "Dropbox changed or has a conflicting path. Your writing was preserved; retry sync."
          : `Dropbox request failed (${response.status}). Check your connection and account access, then retry.`,
      );
    }
  }

  /** Create the backup folder when absent, then return the account email. */
  async function connect() {
    const existing = await rpc(
      "files/get_metadata",
      JSON.stringify({ path: BACKUP_FOLDER_PATH }),
    );

    if (existing.ok) {
      const metadata = parseJson(await existing.text());

      if (jsonString(metadata, ".tag") !== "folder") {
        throw new Error(
          "The Dropbox path lunarscribe-bak-files already exists as a file. Rename it before connecting.",
        );
      }
    } else {
      // Create a folder only when Dropbox reports path/not_found.
      if (existing.status !== 409) checkResponse(existing);

      const failure = parseJson(await existing.text());

      if (!jsonString(failure, "error_summary").startsWith("path/not_found/")) {
        checkResponse(existing);
      }

      const created = await rpc(
        "files/create_folder_v2",
        JSON.stringify({ path: BACKUP_FOLDER_PATH, autorename: false }),
      );

      checkResponse(created);
    }

    const response = await rpc("users/get_current_account", "null");
    checkResponse(response);
    const account = parseJson(await response.text());

    return jsonString(account, "email");
  }

  /** Use immutable download revisions and conditional writes for each sync. */
  function createProvider(): FileSyncProvider {
    async function upload(
      name: string,
      content: string,
      modifiedAt: number,
      mode: WriteMode,
      strictConflict: boolean,
    ) {
      const response = await request(
        "files/upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              path: `${BACKUP_FOLDER_PATH}/${name}`,
              client_modified: new Date(Math.floor(modifiedAt / 1000) * 1000)
                .toISOString()
                .replace(".000Z", "Z"),
              mode,
              autorename: false,
              strict_conflict: strictConflict,
              mute: true,
            }).replaceAll(
              /[\u007f-\uffff]/g,
              (character) =>
                `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
            ),
          },
          body: content,
        },
        true,
      );

      checkResponse(response);
    }

    return {
      /** Read each file at the revision returned by the folder listing. */
      async read() {
        const files: RemoteFiles = new Map();

        let response = await rpc(
          "files/list_folder",
          JSON.stringify({ path: BACKUP_FOLDER_PATH, recursive: false }),
        );

        while (true) {
          checkResponse(response);
          const page = parseJson(await response.text());

          for (const file of jsonArray(page, "entries")) {
            const name = jsonString(file, "name");

            if (!isSavedFileName(name)) {
              continue;
            }

            if (jsonString(file, ".tag") !== "file") {
              files.set(name, {
                content: "",
                revision: "",
                modifiedAt: 0,
                modifiedAtPrecisionMs: 1000,
                blocked: true,
              });

              continue;
            }

            const download = await request(
              "files/download",
              {
                method: "POST",
                headers: {
                  "Dropbox-API-Arg": JSON.stringify({
                    path: `rev:${jsonString(file, "rev")}`,
                  }),
                },
              },
              true,
            );

            checkResponse(download);
            files.set(name, {
              content: await download.text(),
              revision: jsonString(file, "rev"),
              modifiedAt: jsonTimestamp(file, "client_modified"),
              modifiedAtPrecisionMs: 1000,
            });
          }

          if (!jsonBoolean(page, "has_more")) {
            break;
          }

          response = await rpc(
            "files/list_folder/continue",
            JSON.stringify({ cursor: jsonString(page, "cursor") }),
          );
        }

        return files;
      },
      /** Reject replacements and deletions when the saved revision changed. */
      async write(changes, snapshot) {
        for (const change of changes) {
          const revision = snapshot.get(change.name)?.revision;
          const path = `${BACKUP_FOLDER_PATH}/${change.name}`;

          if (change.content === null) {
            const response = await rpc(
              "files/delete_v2",
              JSON.stringify({ path, parent_rev: revision }),
            );

            checkResponse(response);
          } else {
            await upload(
              change.name,
              change.content,
              change.modifiedAt,
              revision
                ? { ".tag": "update", update: revision }
                : { ".tag": "add" },
              true,
            );
          }
        }
      },
      forceWrite: (name, content, modifiedAt) =>
        upload(name, content, modifiedAt, { ".tag": "overwrite" }, false),
    };
  }

  return { connect, createProvider };
}
