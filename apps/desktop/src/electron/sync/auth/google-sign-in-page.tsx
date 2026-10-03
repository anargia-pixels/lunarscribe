import { Button } from "@lunarscribe/components/ui/button";
import { Separator } from "@lunarscribe/components/ui/separator";
import { FileText, FolderSync, PenTool } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import appIcon from "../../../../../../assets/icons/32x32.png?inline";

import styles from "./google-sign-in-page.css?inline";

// Page layout
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="var(--google-blue)"
        d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.16v5.13h6.62c3.87-3.56 6.07-8.8 6.07-14.79Z"
      />
      <path
        fill="var(--google-green)"
        d="M24 44c5.5 0 10.1-1.82 13.54-4.75l-6.62-5.13C29.09 35.35 26.75 36.1 24 36.1c-5.32 0-9.83-3.59-11.45-8.42H5.72v5.3A20 20 0 0 0 24 44Z"
      />
      <path
        fill="var(--google-yellow)"
        d="M12.55 27.68a12 12 0 0 1 0-7.36v-5.3H5.72a20 20 0 0 0 0 17.96l6.83-5.3Z"
      />
      <path
        fill="var(--google-red)"
        d="M24 11.9c3 0 5.69 1.03 7.81 3.05l5.86-5.86A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.72 15.02l6.83 5.3C14.17 15.49 18.68 11.9 24 11.9Z"
      />
    </svg>
  );
}

/** Render the browser page with the shared app controls. */
function GoogleSignInLayout() {
  return (
    <div data-part="page">
      {/* Brand */}
      <header data-part="brand">
        <img src={appIcon} alt="" width={32} height={32} />
        <span>Lunarscribe</span>
      </header>
      <main data-part="connection" aria-labelledby="heading">
        {/* Saved writing */}
        <div data-part="overview">
          <h1 id="heading">
            Your writing.
            <br />
            On every device.
          </h1>
          <p>
            Connect Google Drive to keep your saved markdown and drawings
            together, wherever you write.
          </p>
          <ul data-part="features">
            <li>
              <FileText aria-hidden="true" />
              <span>Saved markdown</span>
            </li>
            <li>
              <PenTool aria-hidden="true" />
              <span>Drawings</span>
            </li>
            <li>
              <FolderSync aria-hidden="true" />
              <span>Syncs every five minutes while the app is open</span>
            </li>
          </ul>
          <Separator />
          <p data-part="destination">
            Your backup folder
            <br />
            <strong>lunarscribe-bak-files</strong>
          </p>
        </div>
        {/* Account sign-in */}
        <div data-part="sign-in" data-state="loading" id="sign-in">
          <div data-part="provider">
            <svg width="40" height="36" viewBox="0 0 48 42" aria-hidden="true">
              <path fill="var(--drive-green)" d="M16 0 0 28h16L32 0Z" />
              <path fill="var(--drive-yellow)" d="m32 0 16 28H32L16 0Z" />
              <path fill="var(--google-blue)" d="m0 28 8 14h32l8-14Z" />
            </svg>
            <span>Google Drive</span>
            <span data-part="badge">WIP</span>
          </div>
          <div data-part="result-icon" aria-hidden="true">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <h2 id="sign-in-heading">Connect your account</h2>
          <p id="description">
            Choose the Google account you want to use for your backups.
          </p>
          <Button id="signin" type="button" variant="outline" disabled>
            <GoogleLogo />
            <span id="button-label">Loading Google sign-in…</span>
          </Button>
          <output id="message" aria-live="polite">
            Preparing sign-in…
          </output>
          <p data-part="access-note">
            Lunarscribe can access only the Drive files you create or open with
            the app.
          </p>
          <noscript>
            Enable JavaScript in your browser, then reconnect from Lunarscribe.
          </noscript>
        </div>
      </main>
      <footer>
        You can disconnect anytime in Settings → General → Syncing.
      </footer>
    </div>
  );
}

// Browser sign-in
/** The browser token model runs on the loopback page, with no app secret. */
export function createGoogleSignInPage(
  clientId: string,
  state: string,
  nonce: string,
) {
  const layout = renderToStaticMarkup(createElement(GoogleSignInLayout));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connect Google Drive · Lunarscribe</title>
    <style>${styles}</style>
  </head>
  <body>
    ${layout}
    <script nonce="${nonce}">
      const panel = document.getElementById("sign-in");
      const heading = document.getElementById("sign-in-heading");
      const description = document.getElementById("description");
      const button = document.getElementById("signin");
      const label = document.getElementById("button-label");
      const message = document.getElementById("message");
      let client;
      let library;
      let loadTimeout;

      // Keep the server-rendered button flags in sync with its browser state.
      function setDisabled(isDisabled) {
        button.disabled = isDisabled;
        button.setAttribute("aria-disabled", String(isDisabled));
        button.toggleAttribute("data-disabled", isDisabled);
        button.tabIndex = isDisabled ? -1 : 0;
      }

      function showError(text, canRetry = true) {
        panel.dataset.state = "error";
        message.textContent = text;
        setDisabled(!canRetry);
        label.textContent = client ? "Sign in with Google" : "Retry loading sign-in";
      }

      // Send the token to Lunarscribe through the local callback.
      async function completeSignIn(tokenResponse) {
        if (tokenResponse.error || !tokenResponse.access_token) {
          showError("Google sign-in was not completed. Try again and approve access to continue.");
          return;
        }

        panel.dataset.state = "sending";
        message.textContent = "Finishing sign-in…";
        label.textContent = "Finishing sign-in…";
        setDisabled(true);

        try {
          const response = await fetch("/oauth/google-drive/token", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({...tokenResponse, state: ${JSON.stringify(state)}}),
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) {
            showError("This sign-in session has ended. Return to Lunarscribe and connect again.", false);
            return;
          }

          panel.dataset.state = "success";
          heading.textContent = "Sign-in complete";
          description.textContent = "Return to Lunarscribe to finish connecting Google Drive and start syncing.";
          message.textContent = "You can close this browser tab.";
        } catch {
          showError("Could not reach Lunarscribe. Return to the app to check your connection or start sign-in again.", false);
        }
      }

      function requestSignIn() {
        panel.dataset.state = "authorizing";
        message.textContent = "Continue in the Google window. If it does not open, allow pop-ups for this page.";
        label.textContent = "Waiting for Google…";
        setDisabled(true);

        try {
          client.requestAccessToken({prompt: "select_account"});
        } catch {
          showError("Google sign-in could not open. Allow pop-ups for this page and try again.");
        }
      }

      function initializeGoogleClient() {
        clearTimeout(loadTimeout);

        try {
          client = google.accounts.oauth2.initTokenClient({
            client_id: ${JSON.stringify(clientId.trim())},
            scope: "https://www.googleapis.com/auth/drive.file",
            callback: completeSignIn,
            error_callback: (error) => showError(error.type === "popup_failed_to_open"
              ? "Google sign-in could not open. Allow pop-ups for this page and try again."
              : "The Google window was closed. You can try signing in again.")
          });
          panel.dataset.state = "ready";
          setDisabled(false);
          label.textContent = "Sign in with Google";
          message.textContent = "A Google sign-in window will open.";
          button.onclick = requestSignIn;
        } catch {
          showError("Google sign-in could not start. Retry loading, or reconnect from Lunarscribe.");
        }
      }

      function loadGoogleLibrary() {
        clearTimeout(loadTimeout);
        if (library) library.remove();
        panel.dataset.state = "loading";
        setDisabled(true);
        label.textContent = "Loading Google sign-in…";
        message.textContent = "Preparing sign-in…";
        library = document.createElement("script");
        library.src = "https://accounts.google.com/gsi/client";
        library.onload = initializeGoogleClient;
        library.onerror = () => {
          clearTimeout(loadTimeout);
          showError("Google sign-in could not load. Check your internet connection and retry.");
        };
        button.onclick = loadGoogleLibrary;
        loadTimeout = setTimeout(() => {
          library.onload = null;
          library.onerror = null;
          library.remove();
          showError("Google sign-in is taking too long to load. Check your connection and retry.");
        }, 12000);
        document.head.appendChild(library);
      }

      loadGoogleLibrary();
    </script>
  </body>
</html>`;
}
