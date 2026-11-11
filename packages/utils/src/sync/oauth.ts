import { jsonNumber, jsonString, parseJson } from "./json";
import { fetchCloud } from "./network";
import { CLOUD_SYNC_PROVIDER_NAMES, SyncSignInRequired } from "./types";
import type { CloudSyncProvider } from "./types";

// Authorization contracts
export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
};

type ProviderEndpoints = {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl: string;
  scope: string;
  offlineParameters: Record<string, string>; // ask for a refresh token
};

/** Registered OAuth endpoints and scopes for each cloud provider. */
export const OAUTH_ENDPOINTS: Record<CloudSyncProvider, ProviderEndpoints> = {
  "google-drive": {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    scope: "https://www.googleapis.com/auth/drive.file",
    offlineParameters: { access_type: "offline", prompt: "consent" },
  },
  dropbox: {
    authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropbox.com/oauth2/token",
    revokeUrl: "https://api.dropboxapi.com/2/auth/token/revoke",
    scope:
      "files.metadata.read files.metadata.write files.content.read files.content.write account_info.read",
    offlineParameters: { token_access_type: "offline" },
  },
};

/** Tokens expire this long before their stated time, so a request never races expiry. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** Whether `tokens` expire within the margin and need a refresh first. */
export function isExpiring(tokens: OAuthTokens) {
  return tokens.expiresAt <= Date.now() + TOKEN_EXPIRY_MARGIN_MS;
}

/** URL-safe base64 without padding, as PKCE and the state check use. */
export function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

// Token exchange
/**
 * Exchange a code or refresh token for tokens. Keeps response bodies out of error
 * messages. A rejected refresh throws `SyncSignInRequired`.
 */
export async function requestTokens(
  provider: CloudSyncProvider,
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<OAuthTokens> {
  const timeout = AbortSignal.timeout(30_000);

  // React Native's fetch needs a string body, so send the form encoded by hand.
  const response = await fetchCloud(
    provider,
    OAUTH_ENDPOINTS[provider].tokenUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: parameters.toString(),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    },
  );

  if (!response.ok) {
    if (
      parameters.get("grant_type") === "refresh_token" &&
      (response.status === 400 || response.status === 401)
    ) {
      throw new SyncSignInRequired(
        `${CLOUD_SYNC_PROVIDER_NAMES[provider]} needs sign-in again. Open the sync settings and select Sign in again. Your writing is safe.`,
      );
    }

    throw new Error(
      "Sign-in could not obtain an access token. Check the public client ID and reconnect.",
    );
  }

  const tokenResponse = parseJson(await response.text());

  return {
    accessToken: jsonString(tokenResponse, "access_token"),
    refreshToken: jsonString(tokenResponse, "refresh_token", true),
    expiresAt: Date.now() + jsonNumber(tokenResponse, "expires_in") * 1000,
    clientId: parameters.get("client_id") ?? "",
  };
}

/**
 * Refresh `tokens`, keeping the old refresh token when the response omits a new one.
 * `clientSecret` is only for Google's Desktop app client, which sends a public secret.
 */
export async function refreshTokens(
  provider: CloudSyncProvider,
  tokens: OAuthTokens,
  clientSecret?: string,
) {
  const parameters = new URLSearchParams({
    client_id: tokens.clientId,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });

  if (clientSecret) {
    parameters.set("client_secret", clientSecret);
  }

  const next = await requestTokens(provider, parameters);

  return { ...next, refreshToken: next.refreshToken || tokens.refreshToken };
}

/**
 * End the provider grant so a copied settings file stops working. Google revokes every
 * client in the Cloud project, so all of the account's devices must sign in again.
 * Dropbox revokes only the grant behind this device's access token.
 */
export async function revokeTokens(
  provider: CloudSyncProvider,
  tokens: OAuthTokens,
) {
  let request: RequestInit;

  if (provider === "google-drive") {
    request = {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: tokens.refreshToken || tokens.accessToken,
      }).toString(),
    };
  } else {
    const { accessToken } = isExpiring(tokens)
      ? await refreshTokens(provider, tokens)
      : tokens;

    request = { headers: { Authorization: `Bearer ${accessToken}` } };
  }

  const response = await fetchCloud(
    provider,
    OAUTH_ENDPOINTS[provider].revokeUrl,
    {
      ...request,
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Revocation failed (${response.status}).`);
  }
}
