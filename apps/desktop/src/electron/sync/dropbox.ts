import { basename } from "node:path";

import { getFileExtension } from "../../lib/editor-files";
import { jsonArray, jsonBoolean, jsonString, parseJson } from "./json";
import type { FileSyncProvider, RemoteFiles } from "./provider";
import { SyncSignInRequired } from "./provider";

const BACKUP_FOLDER_PATH = "/lunarscribe-bak-files";

export function createDropboxApi(accessToken: () => Promise<string>) {
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

  async function rpc(route: string, body: string) {
    return request(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  function check(response: Response) {
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
      // Only a path/not_found response authorizes folder creation.
      const failure = parseJson(await existing.text());

      if (
        existing.status !== 409 ||
        !jsonString(failure, "error_summary").startsWith("path/not_found/")
      ) {
        check(existing);
      }

      const created = await rpc(
        "files/create_folder_v2",
        JSON.stringify({ path: BACKUP_FOLDER_PATH, autorename: false }),
      );

      check(created);
    }

    const response = await rpc("users/get_current_account", "null");
    check(response);
    const account = parseJson(await response.text());

    return jsonString(account, "email");
  }

  function provider(): FileSyncProvider {
    return {
      async read() {
        const files: RemoteFiles = new Map();

        let response = await rpc(
          "files/list_folder",
          JSON.stringify({ path: BACKUP_FOLDER_PATH, recursive: false }),
        );

        while (true) {
          check(response);
          const page = parseJson(await response.text());

          for (const file of jsonArray(page, "entries")) {
            const name = jsonString(file, "name");

            if (name !== basename(name) || !getFileExtension(name)) {
              continue;
            }

            if (jsonString(file, ".tag") !== "file") {
              files.set(name, { content: "", revision: "", blocked: true });

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

            check(download);
            files.set(name, {
              content: await download.text(),
              revision: jsonString(file, "rev"),
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
      async write(changes, snapshot) {
        for (const change of changes) {
          const revision = snapshot.get(change.name)?.revision;
          const path = `${BACKUP_FOLDER_PATH}/${change.name}`;

          if (change.content === null) {
            const response = await rpc(
              "files/delete_v2",
              JSON.stringify({ path, parent_rev: revision }),
            );

            check(response);
          } else {
            const response = await request(
              "files/upload",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/octet-stream",
                  "Dropbox-API-Arg": JSON.stringify({
                    path,
                    mode: revision
                      ? { ".tag": "update", update: revision }
                      : { ".tag": "add" },
                    autorename: false,
                    strict_conflict: true,
                    mute: true,
                  }).replaceAll(
                    /[\u007f-\uffff]/g,
                    (character) =>
                      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
                  ),
                },
                body: change.content,
              },
              true,
            );

            check(response);
          }
        }
      },
    };
  }

  return { connect, provider };
}
