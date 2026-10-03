import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

import { shell } from "electron";

import { createGoogleSignInPage } from "./google-sign-in-page";
import { jsonNumber, jsonString, parseJson } from "./json";
import type { OAuthTokens } from "./oauth";

/** Google's browser token model needs no secret; the user signs in again after expiry. */
export async function signInGoogle(
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
  const server = createServer();
  const pageUrl = `http://127.0.0.1:53682/oauth/google-drive?session=${state}`;

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(53682, "127.0.0.1", () => resolve());
  });

  try {
    return await new Promise<OAuthTokens>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(new Error("Google sign-in timed out. Try connecting again.")),
        180_000,
      );

      const abort = () => reject(new Error("Sign-in cancelled."));
      signal.addEventListener("abort", abort, { once: true });
      server.once("close", () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      });
      server.on("request", (request, response) => {
        if (
          request.method === "GET" &&
          request.url === `/oauth/google-drive?session=${state}`
        ) {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("Referrer-Policy", "no-referrer");
          response.setHeader(
            "Content-Security-Policy",
            `default-src 'none'; script-src 'nonce-${nonce}' https://accounts.google.com; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; style-src 'unsafe-inline'; img-src https://accounts.google.com; base-uri 'none'; frame-ancestors 'none'`,
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
      });

      if (signal.aborted) {
        abort();
      } else {
        void shell.openExternal(pageUrl).catch(reject);
      }
    });
  } finally {
    server.close();
    server.closeAllConnections();
  }
}
