import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { SyncBaseline, SyncProvider } from "../../lib/sync";
import {
  jsonField,
  jsonNumber,
  jsonString,
  jsonStrings,
  parseJson,
} from "./json";
import type { JsonValue } from "./json";
import type { OAuthTokens } from "./oauth";

export type SyncSettings = {
  provider: SyncProvider | null;
  account: string | null;
  folderId: string | null;
  tokens: OAuthTokens | null;
  baseline: SyncBaseline;
  lastSyncedAt: string | null;
};

export function createEmptySettings(): SyncSettings {
  return {
    provider: null,
    account: null,
    folderId: null,
    tokens: null,
    baseline: {},
    lastSyncedAt: null,
  };
}

function parseStoredTokens(storedTokens: JsonValue): OAuthTokens | null {
  // Legacy encrypted strings require browser sign-in again, without a keyring dependency.
  if (storedTokens === null || storedTokens === String(storedTokens)) {
    return null;
  }

  const tokens = {
    accessToken: jsonString(storedTokens, "accessToken"),
    refreshToken: jsonString(storedTokens, "refreshToken"),
    clientId: jsonString(storedTokens, "clientId"),
    expiresAt: jsonNumber(storedTokens, "expiresAt"),
  };

  if (
    !tokens.accessToken ||
    !tokens.clientId ||
    !Number.isFinite(tokens.expiresAt)
  ) {
    throw new Error(
      "Stored sync credentials are invalid. Disconnect and reconnect.",
    );
  }

  return tokens;
}

export function createSyncSettings(directory: string) {
  const path = join(directory, "sync-settings.json");

  return {
    async load(): Promise<SyncSettings> {
      let serialized: string;

      try {
        serialized = await readFile(path, "utf8");
      } catch (cause) {
        if (
          cause instanceof Error &&
          "code" in cause &&
          cause.code === "ENOENT"
        ) {
          return createEmptySettings();
        }

        throw cause;
      }

      const storedSettings = parseJson(serialized);
      const provider = jsonField(storedSettings, "provider");
      const baseline = jsonField(storedSettings, "baseline");

      if (
        (provider !== null &&
          provider !== "github" &&
          provider !== "google-drive" &&
          provider !== "dropbox") ||
        baseline === undefined
      ) {
        throw new Error(
          "Stored sync settings are invalid. Disconnect and reconnect.",
        );
      }

      return {
        provider,
        baseline: jsonStrings(baseline),
        account: jsonString(storedSettings, "account", true) || null,
        folderId: jsonString(storedSettings, "folderId", true) || null,
        tokens: parseStoredTokens(jsonField(storedSettings, "tokens") ?? null),
        lastSyncedAt: jsonString(storedSettings, "lastSyncedAt", true) || null,
      };
    },
    async save(settings: SyncSettings) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = `${path}.${randomUUID()}.tmp`;

      try {
        await writeFile(temporary, JSON.stringify(settings, null, 2), {
          mode: 0o600,
          flag: "wx",
        });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
