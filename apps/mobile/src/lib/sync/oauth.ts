import {
  base64Url,
  OAUTH_ENDPOINTS,
  requestTokens,
} from "@lunarscribe/utils/sync/oauth";
import { CLOUD_SYNC_PROVIDERS } from "@lunarscribe/utils/sync/types";
import type { CloudSyncProvider } from "@lunarscribe/utils/sync/types";
import { CryptoDigestAlgorithm, digest, getRandomBytes } from "expo-crypto";
import { dismissAuthSession, openAuthSessionAsync } from "expo-web-browser";
import { Platform } from "react-native";

import { googleRedirectScheme } from "@/lib/sync/google-redirect";
import publicCredentials from "@/lib/sync/public-creds.json";

/** Google's iOS and Android clients are separate; both are public, without a secret. */
function googleClientId() {
  return Platform.OS === "ios"
    ? publicCredentials.googleIosClientId
    : publicCredentials.googleAndroidClientId;
}

function clientIdFor(provider: CloudSyncProvider) {
  const clientId = (
    provider === "google-drive"
      ? googleClientId()
      : publicCredentials.dropboxAppKey
  ).trim();

  if (!clientId) {
    throw new Error(
      `${CLOUD_SYNC_PROVIDERS[provider]} sign-in is not set up in this build of Lunarscribe.`,
    );
  }

  return clientId;
}

/**
 * Google only redirects a native client to its reversed client ID; Dropbox accepts
 * the app's own scheme. Both must be registered with the provider and in app.config.ts.
 */
function redirectUriFor(provider: CloudSyncProvider, clientId: string) {
  if (provider === "dropbox") {
    return "lunarscribe://oauth/dropbox";
  }

  return `${googleRedirectScheme(clientId)}:/oauth2redirect`;
}

/** A random URL-safe string, for the PKCE verifier and the state check. */
function randomToken(byteLength: number) {
  return base64Url(getRandomBytes(byteLength));
}

// Provider sign-in
/**
 * Signs in with PKCE in the system browser and returns tokens without an app secret.
 * Aborting `signal` closes the browser.
 */
export async function signIn(provider: CloudSyncProvider, signal: AbortSignal) {
  const clientId = clientIdFor(provider);
  const redirectUri = redirectUriFor(provider, clientId);
  const endpoints = OAUTH_ENDPOINTS[provider];
  const verifier = randomToken(48);
  const state = randomToken(32);

  const challenge = base64Url(
    new Uint8Array(
      await digest(
        CryptoDigestAlgorithm.SHA256,
        new TextEncoder().encode(verifier),
      ),
    ),
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

  if (signal.aborted) {
    throw new Error("Sign-in cancelled.");
  }

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
