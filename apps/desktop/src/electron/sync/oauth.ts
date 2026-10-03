import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

import { shell } from "electron";

import type { SyncProvider } from "../../lib/sync";
import { signInGoogle } from "./google-sign-in";
import { jsonNumber, jsonString, parseJson } from "./json";
import { SyncSignInRequired } from "./provider";

export type OAuthProvider = Exclude<SyncProvider, "github">;

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
};

const TOKEN_URLS = {
  "google-drive": "https://oauth2.googleapis.com/token",
  dropbox: "https://api.dropbox.com/oauth2/token",
} as const;

/** Provider error responses never reach the renderer: they can contain credentials. */
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

/** Loopback callback and PKCE keep authorization entirely on this device. */
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

  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const server = createServer();
  const port = 53683;

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || !(address instanceof Object) || !("port" in address)) {
    server.close();
    throw new Error("Unable to start the local sign-in callback.");
  }

  const redirectUri = `http://127.0.0.1:${address.port}/oauth/${provider}`;

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

  try {
    const code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Sign-in timed out. Try connecting again.")),
        180_000,
      );

      const abort = () => reject(new Error("Sign-in cancelled."));
      signal.addEventListener("abort", abort, { once: true });
      server.once("close", () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      });
      server.on("request", (request, response) => {
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
      });

      if (signal.aborted) {
        abort();
      } else {
        void shell.openExternal(authorization.toString()).catch(reject);
      }
    });

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
  } finally {
    server.close();
    server.closeAllConnections();
  }
}
