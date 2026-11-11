import {
  jsonArray,
  jsonNumber,
  jsonString,
  parseJson,
} from "@lunarscribe/utils/sync/json";
import type { JsonValue } from "@lunarscribe/utils/sync/json";
import type { OAuthTokens } from "@lunarscribe/utils/sync/oauth";
import type {
  LocalSyncFile,
  LocalSyncStore,
} from "@lunarscribe/utils/sync/plan";
import {
  createEmptySettings,
  parseSyncSettings,
} from "@lunarscribe/utils/sync/settings";
import type {
  SyncSettings,
  SyncSettingsStore,
} from "@lunarscribe/utils/sync/settings";
import { isCloudSyncProvider } from "@lunarscribe/utils/sync/types";
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digest,
  digestStringAsync,
} from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

import { applySyncedFile, readSyncedFiles } from "@/lib/documents-folder";
import type { SavedFileRecord } from "@/lib/documents-folder";

// Stored state
/**
 * This device cannot set a file's modification time, so a pulled file records the
 * time it was written here (`fileTime`) and the remote copy's time (`modifiedAt`).
 * While the file is unchanged, sync compares the remote time instead.
 */
type PulledFileTimes = Record<string, { fileTime: number; modifiedAt: number }>;

/** A saved file as sync compares it, with its time on this device. */
type LocalFile = LocalSyncFile & { fileTime: number };

/** Everything but the tokens, in a JSON file in the app's Documents folder. */
const settingsFile = new File(Paths.document, "sync-settings.json");

/**
 * The refresh token and client ID, in the iOS Keychain or Android Keystore. Access
 * tokens stay in memory: they are short-lived, and SecureStore values must stay small.
 */
const TOKENS_KEY = "lunarscribe-sync-tokens";

/**
 * Pulled times, kept with the settings in `sync-settings.json`. They hold one
 * destination's times, so they reset when the settings name another destination.
 */
let pulledTimes: PulledFileTimes = {};

let pulledDestination = "";

/** The destination that settings name, as a comparable key. */
function destinationOf(settings: SyncSettings) {
  return JSON.stringify([
    settings.provider,
    settings.account,
    settings.folderId,
  ]);
}

/** The last tokens, so a reload keeps the access token that the store leaves out. */
let currentTokens: OAuthTokens | null = null;

// Hashing
/** Hermes has no Web Crypto, so sync hashes through expo-crypto. */
export async function contentHash(content: LocalSyncFile["content"]) {
  if (!(content instanceof Uint8Array)) {
    return digestStringAsync(CryptoDigestAlgorithm.SHA256, content, {
      encoding: CryptoEncoding.HEX,
    });
  }

  const hash = new Uint8Array(
    await digest(CryptoDigestAlgorithm.SHA256, content),
  );

  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

// Settings
/** Stored as a list of `{ name, fileTime, modifiedAt }`. */
function parsePulledTimes(stored: JsonValue[]): PulledFileTimes {
  return Object.fromEntries(
    stored.map((entry) => [
      jsonString(entry, "name"),
      {
        fileTime: jsonNumber(entry, "fileTime"),
        modifiedAt: jsonNumber(entry, "modifiedAt"),
      },
    ]),
  );
}

async function loadTokens(): Promise<OAuthTokens | null> {
  const serialized = await getItemAsync(TOKENS_KEY);

  if (serialized === null) {
    return null;
  }

  const stored = parseJson(serialized);
  const refreshToken = jsonString(stored, "refreshToken");
  const clientId = jsonString(stored, "clientId");

  if (!refreshToken || !clientId) {
    throw new Error(
      "Stored sync credentials are invalid. Disconnect and reconnect.",
    );
  }

  if (currentTokens?.refreshToken === refreshToken) {
    return currentTokens;
  }

  // Expired, so the first request refreshes it.
  return { accessToken: "", expiresAt: 0, refreshToken, clientId };
}

export const settingsStore: SyncSettingsStore = {
  async load() {
    if (!settingsFile.exists) {
      const settings = createEmptySettings();
      pulledTimes = {};
      pulledDestination = destinationOf(settings);

      return settings;
    }

    const serialized = await settingsFile.text();
    const settings = parseSyncSettings(serialized, isCloudSyncProvider);
    pulledTimes = parsePulledTimes(
      jsonArray(parseJson(serialized), "pulledTimes"),
    );
    pulledDestination = destinationOf(settings);
    settings.tokens = settings.provider === null ? null : await loadTokens();

    return settings;
  },
  async save(settings) {
    const { tokens, ...stored } = settings;
    currentTokens = tokens;

    if (destinationOf(settings) !== pulledDestination) {
      pulledTimes = {};
      pulledDestination = destinationOf(settings);
    }

    if (tokens) {
      await setItemAsync(
        TOKENS_KEY,
        JSON.stringify({
          refreshToken: tokens.refreshToken,
          clientId: tokens.clientId,
        }),
      );
    } else {
      await deleteItemAsync(TOKENS_KEY);
    }

    settingsFile.write(
      JSON.stringify({
        ...stored,
        pulledTimes: Object.entries(pulledTimes).map(([name, times]) => ({
          name,
          ...times,
        })),
      }),
    );
  },
};

// Saved files
/** A saved file, with the remote time while it is still as sync wrote it. */
function toLocalFile(record: SavedFileRecord): LocalFile {
  const pulled = Object.hasOwn(pulledTimes, record.name)
    ? pulledTimes[record.name]
    : undefined;

  return {
    content: record.content,
    fileTime: record.fileTime,
    modifiedAt:
      pulled?.fileTime === record.fileTime
        ? pulled.modifiedAt
        : record.fileTime,
  };
}

export const localSyncStore: LocalSyncStore<LocalFile> = {
  async read(name) {
    const records = await readSyncedFiles(name);

    // Forget pulled times of files edited since sync wrote them.
    if (name === null) {
      const current = new Map(records.map((record) => [record.name, record]));

      pulledTimes = Object.fromEntries(
        Object.entries(pulledTimes).filter(
          ([pulled, times]) => current.get(pulled)?.fileTime === times.fileTime,
        ),
      );
    }

    return new Map(records.map((record) => [record.name, toLocalFile(record)]));
  },
  async apply(change, before) {
    const fileTime = await applySyncedFile(
      change.name,
      before && { name: change.name, ...before },
      change.content,
    );

    if (fileTime === null) {
      return false;
    }

    if (change.content === null) {
      delete pulledTimes[change.name];
    } else {
      pulledTimes[change.name] = { fileTime, modifiedAt: change.modifiedAt };
    }

    return true;
  },
};
