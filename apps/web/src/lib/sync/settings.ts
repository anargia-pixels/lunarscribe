import {
  jsonField,
  jsonNumber,
  jsonString,
  jsonStrings,
  parseJson,
} from "@/lib/sync/json";
import type { JsonValue } from "@/lib/sync/json";
import type { OAuthTokens } from "@/lib/sync/oauth";
import type { SyncBaseline, SyncProvider } from "@/lib/sync/sync-types";

// Stored state
export type SyncSettings = {
  provider: SyncProvider | null;
  account: string | null;
  folderId: string | null;
  tokens: OAuthTokens | null;
  baseline: SyncBaseline;
  lastSyncedAt: string | null;
};

/** localStorage key; every tab reads it, so sync history stays shared. */
export const SYNC_SETTINGS_KEY = "lunarscribe-sync-settings";

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
  if (storedTokens === null) {
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

// Settings storage
/** Treat missing settings as first setup; reject invalid stored state. */
export function loadSyncSettings(): SyncSettings {
  const serialized = localStorage.getItem(SYNC_SETTINGS_KEY);

  if (serialized === null) {
    return createEmptySettings();
  }

  const storedSettings = parseJson(serialized);
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
    account: jsonString(storedSettings, "account", true) || null,
    folderId: jsonString(storedSettings, "folderId", true) || null,
    tokens: parseStoredTokens(jsonField(storedSettings, "tokens") ?? null),
    lastSyncedAt: jsonString(storedSettings, "lastSyncedAt", true) || null,
  };
}

export function saveSyncSettings(settings: SyncSettings) {
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(settings));
}
