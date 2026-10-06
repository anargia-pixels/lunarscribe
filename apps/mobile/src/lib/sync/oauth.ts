import {
  jsonNumber,
  jsonString,
  parseJson,
} from "@lunarscribe/utils/sync/json";
import { SyncSignInRequired } from "@lunarscribe/utils/sync/types";
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytes,
} from "expo-crypto";
import { dismissAuthSession, openAuthSessionAsync } from "expo-web-browser";
import { Platform } from "react-native";

import { googleRedirectScheme } from "@/lib/sync/google-redirect";
import publicCredentials from "@/lib/sync/public-creds.json";
import { SYNC_PROVIDERS } from "@/lib/sync/sync-types";
import type { SyncProvider } from "@/lib/sync/sync-types";

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
  scope: string;
  /** Extra authorize parameters that ask for a refresh token. */
  offlineParameters: Record<string, string>;
};

// Registered OAuth endpoints
const ENDPOINTS: Record<SyncProvider, ProviderEndpoints> = {
  "google-drive": {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.file",
    offlineParameters: { access_type: "offline", prompt: "consent" },
  },
  dropbox: {
    authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropbox.com/oauth2/token",
    scope:
      "files.metadata.read files.metadata.write files.content.read files.content.write account_info.read",
    offlineParameters: { token_access_type: "offline" },
  },
};

/** Google's iOS and Android clients are separate; both are public, without a secret. */
function googleClientId() {
  return Platform.OS === "ios"
    ? publicCredentials.googleIosClientId
    : publicCredentials.googleAndroidClientId;
}

function clientIdFor(provider: SyncProvider) {
  const clientId = (
    provider === "google-drive"
      ? googleClientId()
      : publicCredentials.dropboxAppKey
  ).trim();

  if (!clientId) {
    throw new Error(
      `${SYNC_PROVIDERS[provider]} sign-in is not set up in this build of Lunarscribe.`,
    );
  }

  return clientId;
}

/**
 * Google only redirects a native client to its reversed client ID; Dropbox accepts
 * the app's own scheme. Both must be registered with the provider and in app.config.ts.
 */
function redirectUriFor(provider: SyncProvider, clientId: string) {
  if (provider === "dropbox") {
    return "lunarscribe://oauth/dropbox";
  }

  return `${googleRedirectScheme(clientId)}:/oauth2redirect`;
}

/** Converts base64 to the URL-safe, unpadded form PKCE uses. */
function base64Url(base64: string) {
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** A random URL-safe string, for the PKCE verifier and the state check. */
function randomToken(byteLength: number) {
  return base64Url(btoa(String.fromCodePoint(...getRandomBytes(byteLength))));
}

// Token exchange
/** Keep token response bodies out of user-facing error messages. */
async function requestTokens(
  provider: SyncProvider,
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<OAuthTokens> {
  const timeout = AbortSignal.timeout(30_000);

  const response = await fetch(ENDPOINTS[provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parameters.toString(),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  if (!response.ok) {
    if (
      parameters.get("grant_type") === "refresh_token" &&
      (response.status === 400 || response.status === 401)
    ) {
      throw new SyncSignInRequired(
        `${SYNC_PROVIDERS[provider]} needs sign-in again. Open Settings and select Sign in again.`,
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

/** Keep the old refresh token when the response omits a new one. */
export async function refreshTokens(
  provider: SyncProvider,
  tokens: OAuthTokens,
) {
  const next = await requestTokens(
    provider,
    new URLSearchParams({
      client_id: tokens.clientId,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
  );

  return { ...next, refreshToken: next.refreshToken || tokens.refreshToken };
}

// Provider sign-in
/** Stops a cancelled sign-in; React Native's `AbortSignal` lacks `throwIfAborted`. */
export function assertSignInActive(signal: AbortSignal) {
  if (signal.aborted) {
    throw new Error("Sign-in cancelled.");
  }
}

/**
 * Signs in with PKCE in the system browser and returns tokens without an app secret.
 * Aborting `signal` closes the browser.
 */
export async function signIn(provider: SyncProvider, signal: AbortSignal) {
  const clientId = clientIdFor(provider);
  const redirectUri = redirectUriFor(provider, clientId);
  const endpoints = ENDPOINTS[provider];
  const verifier = randomToken(48);
  const state = randomToken(32);

  const challenge = base64Url(
    await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: CryptoEncoding.BASE64,
    }),
  );

  const authorization = new URL(endpoints.authorizeUrl);

  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: endpoints.scope,
    ...endpoints.offlineParameters,
  }).toString();

  signal.addEventListener("abort", dismissAuthSession, { once: true });

  let authSession: Awaited<ReturnType<typeof openAuthSessionAsync>>;

  try {
    authSession = await openAuthSessionAsync(
      authorization.toString(),
      redirectUri,
    );
  } finally {
    signal.removeEventListener("abort", dismissAuthSession);
  }

  assertSignInActive(signal);

  if (authSession.type !== "success") {
    throw new Error("Sign-in cancelled.");
  }

  const callback = new URL(authSession.url);
  const code = callback.searchParams.get("code");

  if (callback.searchParams.get("state") !== state) {
    throw new Error("Invalid sign-in callback.");
  }

  if (!code || callback.searchParams.has("error")) {
    throw new Error(
      "Sign-in was declined. Your sync settings have not changed.",
    );
  }

  const tokens = await requestTokens(
    provider,
    new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal,
  );

  if (!tokens.refreshToken) {
    throw new Error(
      "Sign-in did not grant background access. Reconnect and approve offline access.",
    );
  }

  return tokens;
}
