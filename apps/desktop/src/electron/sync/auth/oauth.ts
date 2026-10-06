import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  jsonNumber,
  jsonString,
  parseJson,
} from "@lunarscribe/utils/sync/json";
import { SyncSignInRequired } from "@lunarscribe/utils/sync/types";
import { shell } from "electron";

import type { SyncProvider } from "../../../lib/sync";
import publicCredentials from "../public-creds.json";
import { createSignInResultPage } from "./sign-in-page";

// Authorization contracts
export type OAuthProvider = Exclude<SyncProvider, "github">;

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
};

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

const TOKEN_URLS = {
  "google-drive": "https://oauth2.googleapis.com/token",
  dropbox: "https://api.dropbox.com/oauth2/token",
} as const;

const AUTHORIZE_URLS = {
  "google-drive": "https://accounts.google.com/o/oauth2/v2/auth",
  dropbox: "https://www.dropbox.com/oauth2/authorize",
} as const;

const REVOKE_URLS = {
  "google-drive": "https://oauth2.googleapis.com/revoke",
  dropbox: "https://api.dropboxapi.com/2/auth/token/revoke",
} as const;

const SCOPES = {
  "google-drive": "https://www.googleapis.com/auth/drive.file",
  dropbox:
    "files.metadata.read files.metadata.write files.content.read files.content.write account_info.read",
} as const;

/** Authorize parameters that ask each provider for a refresh token. */
const OFFLINE_PARAMETERS = {
  "google-drive": { access_type: "offline", prompt: "consent" },
  dropbox: { token_access_type: "offline" },
} as const;

/**
 * Google's Desktop app clients send their secret with every token request. Google
 * treats it as public for installed apps, so it ships in `public-creds.json`.
 */
const CLIENT_SECRETS: Partial<Record<OAuthProvider, string>> = {
  "google-drive": publicCredentials.googleClientSecret,
};

// Browser authorization
/** Stop the local server after success, failure, timeout, or cancel. */
async function authorizeInBrowser<T>(
  provider: OAuthProvider,
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
/** Keep token response bodies out of renderer error messages. */
async function requestTokens(
  provider: OAuthProvider,
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<OAuthTokens> {
  const clientSecret = CLIENT_SECRETS[provider];

  if (clientSecret) {
    parameters.set("client_secret", clientSecret);
  }

  const response = await fetch(TOKEN_URLS[provider], {
    method: "POST",
    body: parameters,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    if (
      parameters.get("grant_type") === "refresh_token" &&
      (response.status === 400 || response.status === 401)
    ) {
      throw new SyncSignInRequired(
        `${provider === "google-drive" ? "Google Drive" : "Dropbox"} needs sign-in again. Open Settings → Syncing and select Sign in again.`,
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
  provider: OAuthProvider,
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

/**
 * End the provider grant so a copied settings file stops working. Google revokes every
 * client in the Cloud project, so all of the account's devices must sign in again.
 * Dropbox revokes only the grant behind this device's access token.
 */
export async function revokeTokens(
  provider: OAuthProvider,
  tokens: OAuthTokens,
) {
  let request: RequestInit;

  if (provider === "google-drive") {
    request = {
      body: new URLSearchParams({
        token: tokens.refreshToken || tokens.accessToken,
      }),
    };
  } else {
    const { accessToken } =
      tokens.expiresAt <= Date.now() + 60_000
        ? await refreshTokens(provider, tokens)
        : tokens;

    request = { headers: { Authorization: `Bearer ${accessToken}` } };
  }

  const response = await fetch(REVOKE_URLS[provider], {
    ...request,
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Revocation failed (${response.status}).`);
  }
}

// Provider sign-in
/** Open provider sign-in in the browser and exchange its code for tokens. */
export async function signIn(
  provider: OAuthProvider,
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
  const authorization = new URL(AUTHORIZE_URLS[provider]);

  authorization.search = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state,
    scope: SCOPES[provider],
    ...OFFLINE_PARAMETERS[provider],
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

  const tokens = await requestTokens(
    provider,
    new URLSearchParams({
      client_id: clientId.trim(),
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
