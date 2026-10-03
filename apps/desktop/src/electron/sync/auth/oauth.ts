import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import { shell } from "electron";

import type { SyncProvider } from "../../../lib/sync";
import { jsonNumber, jsonString, parseJson } from "../json";
import { SyncSignInRequired } from "../providers/types";
import { createGoogleSignInPage } from "./google-sign-in-page";

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
        () =>
          reject(
            new Error(
              provider === "google-drive"
                ? "Google sign-in timed out. Try connecting again."
                : "Sign-in timed out. Try connecting again.",
            ),
          ),
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

/** Google grants a browser access token; expiry requires another sign-in. */
async function signInGoogle(
  clientId: string,
  signal: AbortSignal,
): Promise<OAuthTokens> {
  if (
    !/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/u.test(clientId.trim())
  ) {
    throw new Error(
      "Enter the app's public Google Web application client ID before signing in.",
    );
  }

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const pageUrl = SIGN_IN_URLS["google-drive"] + "?session=" + state;

  return authorizeInBrowser<OAuthTokens>(
    "google-drive",
    pageUrl,
    signal,
    (request, response, resolve, reject) => {
      if (
        request.method === "GET" &&
        request.url === `/oauth/google-drive?session=${state}`
      ) {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader(
          "Content-Security-Policy",
          `default-src 'none'; script-src 'nonce-${nonce}' https://accounts.google.com; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; style-src 'unsafe-inline'; font-src data:; img-src https://accounts.google.com; base-uri 'none'; frame-ancestors 'none'`,
        );
        response.end(createGoogleSignInPage(clientId, state, nonce));

        return;
      }

      if (
        request.method !== "POST" ||
        request.url !== "/oauth/google-drive/token" ||
        request.headers.origin !== "http://127.0.0.1:53682"
      ) {
        response.writeHead(400).end("Invalid sign-in callback.");

        return;
      }

      let serialized = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        serialized += chunk;

        if (serialized.length > 16_384) {
          request.destroy();
          reject(new Error("Invalid sign-in callback."));
        }
      });
      request.on("end", () => {
        try {
          const data = parseJson(serialized);

          if (jsonString(data, "state") !== state) {
            response.writeHead(400).end("Invalid sign-in state.");

            return;
          }

          if (jsonString(data, "error", true)) {
            throw new Error("Google sign-in was declined.");
          }

          const accessToken = jsonString(data, "access_token");
          const duration = jsonNumber(data, "expires_in");

          if (!accessToken || duration <= 0) {
            throw new Error(
              "Google sign-in did not return a usable access token.",
            );
          }

          response.setHeader("Cache-Control", "no-store");
          response.end("Signed in.");
          resolve({
            accessToken,
            refreshToken: "",
            expiresAt: Date.now() + duration * 1000,
            clientId: clientId.trim(),
          });
        } catch {
          response.writeHead(400).end("Sign-in failed.");
          reject(
            new Error(
              "Google sign-in failed. Check the Web application client ID and authorized JavaScript origin, then retry.",
            ),
          );
        }
      });
    },
  );
}

// Token exchange
/** Keep token response bodies out of renderer error messages. */
async function requestTokens(
  provider: OAuthProvider,
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<OAuthTokens> {
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
        "Dropbox needs sign-in again. Open Settings → Syncing and select Sign in again.",
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

// Provider sign-in
/** Open provider sign-in and return tokens without an app secret. */
export async function signIn(
  provider: OAuthProvider,
  clientId: string,
  signal: AbortSignal,
) {
  if (provider === "google-drive") {
    return signInGoogle(clientId, signal);
  }

  if (!clientId.trim()) {
    throw new Error(
      "Enter the app's public OAuth client ID before signing in.",
    );
  }

  // Dropbox checks callback state and PKCE before exchanging the code.
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const redirectUri = SIGN_IN_URLS.dropbox;
  const authorization = new URL("https://www.dropbox.com/oauth2/authorize");

  authorization.search = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state,
    token_access_type: "offline",
    scope:
      "files.metadata.read files.metadata.write files.content.read files.content.write account_info.read",
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
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end(
        "Return to Lunarscribe to finish signing in. You can close this browser tab.",
      );

      if (authorizationCode && !callback.searchParams.has("error")) {
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
