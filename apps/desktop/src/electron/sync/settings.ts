import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { safeStorage } from "electron";

import type { SyncBaseline, SyncProvider } from "../../lib/sync";
import {
  jsonField,
  jsonNumber,
  jsonString,
  jsonStrings,
  parseJson,
} from "./json";
import type { OAuthTokens } from "./oauth";

export type SyncSettings = {
  provider: SyncProvider | null;
  account: string | null;
  folderId: string | null;
  tokens: string | null;
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

/** Refuse Linux's plaintext fallback instead of silently storing refresh tokens insecurely. */
export function requireTokenEncryption() {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  ) {
    throw new Error(
      "Secure credential storage is unavailable. Enable your system keyring, then reconnect.",
    );
  }
}

export function encryptTokens(tokens: OAuthTokens) {
  requireTokenEncryption();

  return safeStorage.encryptString(JSON.stringify(tokens)).toString("base64");
}

export function decryptTokens(encrypted: string): OAuthTokens {
  requireTokenEncryption();

  const storedTokens = parseJson(
    safeStorage.decryptString(Buffer.from(encrypted, "base64")),
  );

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
        tokens: jsonString(storedSettings, "tokens", true) || null,
        lastSyncedAt: jsonString(storedSettings, "lastSyncedAt", true) || null,
      };
    },
    async save(settings: SyncSettings) {
      await mkdir(directory, { recursive: true });
      const temporary = `${path}.tmp`;
      await writeFile(temporary, JSON.stringify(settings), { mode: 0o600 });
      await rename(temporary, path);
    },
  };
}
