import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  OAUTH_ENDPOINTS,
  refreshTokens as refreshSharedTokens,
  requestTokens,
} from "@lunarscribe/utils/sync/oauth";
import type { OAuthTokens } from "@lunarscribe/utils/sync/oauth";
import type { CloudSyncProvider } from "@lunarscribe/utils/sync/types";
import { shell } from "electron";

import publicCredentials from "../public-creds.json";
import { createSignInResultPage } from "./sign-in-page";

// Authorization contracts
type BrowserCallback<T> = (
  request: IncomingMessage,
  response: ServerResponse,
  resolve: (value: T) => void,
  reject: (error: Error) => void,
) => void;

// Registered OAuth endpoints
const SIGN_IN_URLS = {
  "google-drive": "http://127.0.0.1:53682/oauth/google-drive",
  dropbox: "http://127.0.0.1:53683/oauth/dropbox",
} as const;

/**
 * Google's Desktop app clients send their secret with every token request. Google
 * treats it as public for installed apps, so it ships in `public-creds.json`.
 */
const CLIENT_SECRETS: Partial<Record<CloudSyncProvider, string>> = {
  "google-drive": publicCredentials.googleClientSecret,
};

// Browser authorization
/** Stop the local server after success, failure, timeout, or cancel. */
async function authorizeInBrowser<T>(
  provider: CloudSyncProvider,
  browserUrl: string,
  signal: AbortSignal,
  callback: BrowserCallback<T>,
): Promise<T> {
  const server = createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(
        Number(new URL(SIGN_IN_URLS[provider]).port),
        "127.0.0.1",
        () => {
          server.off("error", reject);
          resolve();
        },
      );
    });

    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Sign-in timed out. Try connecting again.")),
        180_000,
      );

      const abort = () => reject(new Error("Sign-in cancelled."));
      signal.addEventListener("abort", abort, { once: true });
      server.once("error", reject);
      server.once("close", () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      });
      server.on("request", (request, response) => {
        try {
          callback(request, response, resolve, reject);
        } catch {
          response.writeHead(400).end("Invalid sign-in callback.");
          reject(new Error("Invalid sign-in callback."));
        }
      });

      if (signal.aborted) {
        abort();
      } else {
        void shell.openExternal(browserUrl).catch(reject);
      }
    });
  } finally {
    // Let the callback response finish before closing its connection.
    if (server.listening) server.close();
    server.closeIdleConnections();
  }
}

// Token exchange
/** Refresh with the client secret Google's Desktop app client sends. */
export function refreshTokens(
  provider: CloudSyncProvider,
  tokens: OAuthTokens,
) {
  return refreshSharedTokens(provider, tokens, CLIENT_SECRETS[provider]);
}

// Provider sign-in
/** Open provider sign-in in the browser and exchange its code for tokens. */
export async function signIn(
  provider: CloudSyncProvider,
  clientId: string,
  signal: AbortSignal,
) {
  if (!clientId.trim()) {
    throw new Error(
      "Enter the app's public OAuth client ID before signing in.",
    );
  }

  // Sign-in checks callback state and PKCE before exchanging the code.
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const redirectUri = SIGN_IN_URLS[provider];
  const endpoints = OAUTH_ENDPOINTS[provider];
  const authorization = new URL(endpoints.authorizeUrl);

  authorization.search = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state,
    scope: endpoints.scope,
    ...endpoints.offlineParameters,
  }).toString();

  const code = await authorizeInBrowser<string>(
    provider,
    authorization.toString(),
    signal,
    (request, response, resolve, reject) => {
      const callback = new URL(request.url ?? "/", redirectUri);

      if (
        callback.pathname !== `/oauth/${provider}` ||
        callback.searchParams.get("state") !== state
      ) {
        response.writeHead(400).end("Invalid sign-in callback.");

        return;
      }

      const authorizationCode = callback.searchParams.get("code");

      const isApproved =
        authorizationCode !== null && !callback.searchParams.has("error");

      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; frame-ancestors 'none'",
      );
      response.end(createSignInResultPage(provider, isApproved));

      if (authorizationCode && isApproved) {
        resolve(authorizationCode);
      } else {
        reject(
          new Error(
            "Sign-in was declined. Your sync settings have not changed.",
          ),
        );
      }
    },
  );

  const parameters = new URLSearchParams({
    client_id: clientId.trim(),
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const clientSecret = CLIENT_SECRETS[provider];

  if (clientSecret) {
    parameters.set("client_secret", clientSecret);
  }

  const tokens = await requestTokens(provider, parameters, signal);

  if (!tokens.refreshToken) {
    throw new Error(
      "Sign-in did not grant background access. Reconnect and approve offline access.",
    );
  }

  return tokens;
}
