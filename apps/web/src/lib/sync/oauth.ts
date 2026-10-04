import {
  jsonNumber,
  jsonString,
  parseJson,
} from "@lunarscribe/utils/sync/json";
import { SyncSignInRequired } from "@lunarscribe/utils/sync/types";

import type { SyncProvider } from "@/lib/sync/sync-types";

// Authorization contracts
export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
};

/** What the Dropbox redirect page posts back to the tab that opened the popup. */
export type OAuthCallback = {
  state: string;
  code: string | null;
  error: string | null;
};

/** Channel the `/oauth/dropbox` route uses to hand the code back. */
export const OAUTH_CHANNEL = "lunarscribe-oauth";

const SIGN_IN_TIMEOUT_MS = 180_000;

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const DROPBOX_TOKEN_URL = "https://api.dropbox.com/oauth2/token";

function dropboxRedirectUri() {
  return `${window.location.origin}/oauth/dropbox`;
}

function randomToken(byteLength: number) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

/** Rejects on cancel or after the sign-in timeout, and always cleans up. */
function withSignInLimits<T>(
  signal: AbortSignal,
  start: (resolve: (value: T) => void, reject: (error: Error) => void) => void,
  cleanup?: () => void,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};

  return new Promise<T>((resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Sign-in timed out. Try connecting again.")),
      SIGN_IN_TIMEOUT_MS,
    );

    abort = () => reject(new Error("Sign-in cancelled."));
    signal.addEventListener("abort", abort, { once: true });

    if (signal.aborted) {
      abort();
    } else {
      start(resolve, reject);
    }
  }).finally(() => {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    cleanup?.();
  });
}

// Google
let googleScript: Promise<void> | null = null;

/** Loads Google Identity Services once, on the first Google Drive sign-in. */
function loadGoogleScript() {
  googleScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      googleScript = null;
      script.remove();
      reject(
        new Error("Google sign-in could not load. Check your connection."),
      );
    });
    document.head.append(script);
  });

  return googleScript;
}

/** Google grants a short-lived browser access token; expiry requires another sign-in. */
async function signInGoogle(
  clientId: string,
  signal: AbortSignal,
): Promise<OAuthTokens> {
  await loadGoogleScript();

  const oauth2 = window.google?.accounts.oauth2;

  if (!oauth2) {
    throw new Error("Google sign-in could not load. Check your connection.");
  }

  return withSignInLimits<OAuthTokens>(signal, (resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        const duration = Number(response.expires_in);

        if (response.error || !response.access_token || !(duration > 0)) {
          reject(new Error("Google sign-in was declined."));

          return;
        }

        resolve({
          accessToken: response.access_token,
          refreshToken: "",
          expiresAt: Date.now() + duration * 1000,
          clientId,
        });
      },
      error_callback: (error) =>
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Sign-in cancelled."
              : "Google sign-in failed. Allow pop-ups for this site, then retry.",
          ),
        ),
    });

    client.requestAccessToken();
  });
}

// Dropbox
/** Keep token response bodies out of user-facing error messages. */
async function requestDropboxTokens(
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<OAuthTokens> {
  const response = await fetch(DROPBOX_TOKEN_URL, {
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
export async function refreshDropboxTokens(tokens: OAuthTokens) {
  const next = await requestDropboxTokens(
    new URLSearchParams({
      client_id: tokens.clientId,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
  );

  return { ...next, refreshToken: next.refreshToken || tokens.refreshToken };
}

/** Dropbox PKCE in a pop-up; the redirect route posts the code back over a channel. */
async function signInDropbox(
  clientId: string,
  signal: AbortSignal,
): Promise<OAuthTokens> {
  // Open the pop-up before any await so the browser counts the click.
  const popup = window.open("about:blank", "lunarscribe-dropbox", "popup");

  if (!popup) {
    throw new Error("Allow pop-ups for this site, then retry Dropbox sign-in.");
  }

  const verifier = randomToken(48);
  const state = randomToken(32);

  const challenge = base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );

  const authorization = new URL("https://www.dropbox.com/oauth2/authorize");

  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: dropboxRedirectUri(),
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    token_access_type: "offline",
    scope:
      "files.metadata.read files.metadata.write files.content.read files.content.write account_info.read",
  }).toString();

  const channel = new BroadcastChannel(OAUTH_CHANNEL);

  const code = await withSignInLimits<string>(
    signal,
    (resolve, reject) => {
      channel.addEventListener(
        "message",
        (event: MessageEvent<OAuthCallback>) => {
          if (event.data.state !== state) {
            return;
          }

          if (event.data.code && !event.data.error) {
            resolve(event.data.code);
          } else {
            reject(
              new Error(
                "Sign-in was declined. Your sync settings have not changed.",
              ),
            );
          }
        },
      );
      popup.location.href = authorization.toString();
    },
    () => {
      channel.close();
      popup.close();
    },
  );

  const tokens = await requestDropboxTokens(
    new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: dropboxRedirectUri(),
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

// Provider sign-in
/** Open provider sign-in and return tokens without an app secret. */
export function signIn(
  provider: SyncProvider,
  clientId: string,
  signal: AbortSignal,
) {
  const id = clientId.trim();

  if (!id) {
    throw new Error(
      "Enter the app's public OAuth client ID before signing in.",
    );
  }

  return provider === "google-drive"
    ? signInGoogle(id, signal)
    : signInDropbox(id, signal);
}
