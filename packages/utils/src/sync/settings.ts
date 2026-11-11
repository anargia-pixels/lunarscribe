import {
  jsonField,
  jsonNumber,
  jsonString,
  jsonStrings,
  parseJson,
} from "./json";
import type { JsonValue } from "./json";
import type { OAuthTokens } from "./oauth";
import type { CloudSyncProvider, SyncBaseline } from "./types";

// Settings
/** The stored sync destination and comparison history. */
export type SyncSettings<Provider extends string = CloudSyncProvider> = {
  provider: Provider | null;
  account: string | null;
  folderId: string | null; // Google Drive folder
  tokens: OAuthTokens | null;
  baseline: SyncBaseline;
  lastSyncedAt: string | null;
};

export type SyncSettingsStore<Provider extends string = CloudSyncProvider> = {
  /** Read the stored settings; missing settings are first setup. */
  load: () => Promise<SyncSettings<Provider>>;
  save: (settings: SyncSettings<Provider>) => Promise<void>;
};

export function createEmptySettings<
  Provider extends string = CloudSyncProvider,
>(): SyncSettings<Provider> {
  return {
    provider: null,
    account: null,
    folderId: null,
    tokens: null,
    baseline: {},
    lastSyncedAt: null,
  };
}

// Parsing
/** Stored tokens; a legacy encrypted string means sign-in is required again. */
function parseStoredTokens(stored: JsonValue): OAuthTokens | null {
  if (stored === null || stored === String(stored)) {
    return null;
  }

  const tokens = {
    accessToken: jsonString(stored, "accessToken"),
    refreshToken: jsonString(stored, "refreshToken"),
    clientId: jsonString(stored, "clientId"),
    expiresAt: jsonNumber(stored, "expiresAt"),
  };

  if (!tokens.accessToken || !tokens.clientId) {
    throw new Error(
      "Stored sync credentials are invalid. Disconnect and reconnect.",
    );
  }

  return tokens;
}

/**
 * Parse settings stored as JSON by `JSON.stringify(settings)`. Throws on invalid state,
 * so a broken file never syncs against an empty baseline.
 */
export function parseSyncSettings<Provider extends string>(
  serialized: string,
  isProvider: (value: string) => value is Provider,
): SyncSettings<Provider> {
  const stored = parseJson(serialized);
  const provider = jsonString(stored, "provider", true);
  const baseline = jsonField(stored, "baseline");

  if ((provider && !isProvider(provider)) || baseline === undefined) {
    throw new Error(
      "Stored sync settings are invalid. Disconnect and reconnect.",
    );
  }

  return {
    provider: provider && isProvider(provider) ? provider : null,
    baseline: jsonStrings(baseline),
    account: jsonString(stored, "account", true) || null,
    folderId: jsonString(stored, "folderId", true) || null,
    tokens: parseStoredTokens(jsonField(stored, "tokens") ?? null),
    lastSyncedAt: jsonString(stored, "lastSyncedAt", true) || null,
  };
}
