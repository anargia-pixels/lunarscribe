import {
  jsonArray,
  jsonField,
  jsonNumber,
  jsonString,
  jsonStrings,
  parseJson,
} from "@lunarscribe/utils/sync/json";
import type { JsonValue } from "@lunarscribe/utils/sync/json";
import { File, Paths } from "expo-file-system";
import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

import type { OAuthTokens } from "@/lib/sync/oauth";
import type { SyncBaseline, SyncProvider } from "@/lib/sync/sync-types";

// Stored state
/**
 * This device cannot set a file's modification time, so a pulled file records the
 * time it was written here (`fileTime`) and the remote copy's time (`modifiedAt`).
 * While the file is unchanged, sync compares the remote time instead.
 */
export type PulledFileTimes = Record<
  string,
  { fileTime: number; modifiedAt: number }
>;

export type SyncSettings = {
  provider: SyncProvider | null;
  account: string | null;
  folderId: string | null;
  tokens: OAuthTokens | null;
  baseline: SyncBaseline;
  pulledTimes: PulledFileTimes;
  lastSyncedAt: string | null;
};

/** Everything but the tokens, in a JSON file in the app's Documents folder. */
const settingsFile = new File(Paths.document, "sync-settings.json");

/**
 * The refresh token and client ID, in the iOS Keychain or Android Keystore. Access
 * tokens stay in memory: they are short-lived, and SecureStore values must stay small.
 */
const TOKENS_KEY = "lunarscribe-sync-tokens";

export function createEmptySettings(): SyncSettings {
  return {
    provider: null,
    account: null,
    folderId: null,
    tokens: null,
    baseline: {},
    pulledTimes: {},
    lastSyncedAt: null,
  };
}

/** Stored as a list of `{ name, fileTime, modifiedAt }`. */
function parsePulledTimes(stored: JsonValue[]) {
  return Object.fromEntries(
    stored.map((entry) => [
      jsonString(entry, "name"),
      {
        fileTime: jsonNumber(entry, "fileTime"),
        modifiedAt: jsonNumber(entry, "modifiedAt"),
      },
    ]),
  ) satisfies PulledFileTimes;
}

async function loadTokens(): Promise<OAuthTokens | null> {
  const serialized = await getItemAsync(TOKENS_KEY);

  if (serialized === null) {
    return null;
  }

  const stored = parseJson(serialized);

  const tokens = {
    // Expired on load, so the first request refreshes it.
    accessToken: "",
    expiresAt: 0,
    refreshToken: jsonString(stored, "refreshToken"),
    clientId: jsonString(stored, "clientId"),
  };

  if (!tokens.refreshToken || !tokens.clientId) {
    throw new Error(
      "Stored sync credentials are invalid. Disconnect and reconnect.",
    );
  }

  return tokens;
}

// Settings storage
/** Treat missing settings as first setup; reject invalid stored state. */
export async function loadSyncSettings(): Promise<SyncSettings> {
  if (!settingsFile.exists) {
    return createEmptySettings();
  }

  const storedSettings = parseJson(await settingsFile.text());
  const provider = jsonField(storedSettings, "provider");
  const baseline = jsonField(storedSettings, "baseline");

  if (
    (provider !== null &&
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
    pulledTimes: parsePulledTimes(jsonArray(storedSettings, "pulledTimes")),
    account: jsonString(storedSettings, "account", true) || null,
    folderId: jsonString(storedSettings, "folderId", true) || null,
    tokens: provider === null ? null : await loadTokens(),
    lastSyncedAt: jsonString(storedSettings, "lastSyncedAt", true) || null,
  };
}

export async function saveSyncSettings(settings: SyncSettings) {
  const { tokens, pulledTimes, ...stored } = settings;

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
}
