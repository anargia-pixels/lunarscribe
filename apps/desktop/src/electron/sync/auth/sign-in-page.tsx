import { Button } from "@lunarscribe/components/ui/button";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import appIcon from "../../../../../../assets/icons/32x32.png?inline";
import type { OAuthProvider } from "./oauth";

import styles from "./sign-in-page.css?inline";

// Provider marks
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

function DriveLogo() {
  return (
    <svg width="44" height="40" viewBox="0 0 48 42" aria-hidden="true">
      <path fill="var(--drive-green)" d="M16 0 0 28h16L32 0Z" />
      <path fill="var(--drive-yellow)" d="m32 0 16 28H32L16 0Z" />
      <path fill="var(--google-blue)" d="m0 28 8 14h32l8-14Z" />
    </svg>
  );
}

function DropboxLogo() {
  return (
    <svg width="44" height="40" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="var(--dropbox-blue)"
        d="M6 1.807 0 5.629l6 3.822 6.001-3.822L6 1.807ZM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822ZM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822ZM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822ZM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371Z"
      />
    </svg>
  );
}

const PROVIDERS = {
  "google-drive": { name: "Google Drive", logo: <DriveLogo /> },
  dropbox: { name: "Dropbox", logo: <DropboxLogo /> },
} as const;

// Page layout
type SignInCardProps = {
  provider: OAuthProvider;
  // The Google page script moves "loading" on through its own states.
  state: "loading" | "success" | "failed";
  heading: string;
  description: ReactNode;
  children?: ReactNode;
};

/** One centered card: provider mark, outcome icon, heading, then controls. */
function SignInCard({
  provider,
  state,
  heading,
  description,
  children,
}: SignInCardProps) {
  return (
    <div data-part="page">
      <header data-part="brand">
        <img src={appIcon} alt="" width={28} height={28} />
        <span>Lunarscribe</span>
      </header>
      <main data-part="card" data-state={state} id="sign-in">
        <div data-part="logo">{PROVIDERS[provider].logo}</div>
        <div data-part="result-icon" data-result="success" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <div data-part="result-icon" data-result="error" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <h1 id="sign-in-heading">{heading}</h1>
        <p id="description">{description}</p>
        {children}
      </main>
      <footer>You can stop syncing anytime in Lunarscribe settings.</footer>
    </div>
  );
}

/** Wrap rendered markup in a page that needs only inline styles and images. */
function createPage(title: string, body: string, script = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} · Lunarscribe</title>
    <style>${styles}</style>
  </head>
  <body>
    ${body}
${script}
  </body>
</html>`;
}

// Browser sign-in
/** The browser token model runs on the loopback page, with no app secret. */
export function createGoogleSignInPage(
  clientId: string,
  state: string,
  nonce: string,
) {
  const layout = renderToStaticMarkup(
    <SignInCard
      provider="google-drive"
      state="loading"
      heading="Connect Google Drive"
      description={
        <>
          Lunarscribe keeps a copy of your notes and drawings in a folder called{" "}
          <strong>lunarscribe-bak-files</strong> in your Google Drive.
        </>
      }
    >
      <Button id="signin" type="button" variant="outline" disabled>
        <GoogleLogo />
        <span id="button-label">Loading Google sign-in…</span>
      </Button>
      <output id="message" aria-live="polite">
        Getting sign-in ready…
      </output>
      <p data-part="note">
        Lunarscribe can only see the files it makes in your Drive.
      </p>
      <noscript>
        Turn on JavaScript in your browser, then select Connect again in
        Lunarscribe.
      </noscript>
    </SignInCard>,
  );

  return createPage(
    "Connect Google Drive",
    layout,
    `    <script nonce="${nonce}">
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
        label.textContent = client ? "Sign in with Google" : "Try again";
      }

      // Send the token to Lunarscribe through the local callback.
      async function completeSignIn(tokenResponse) {
        if (tokenResponse.error || !tokenResponse.access_token) {
          showError("Sign-in did not finish. Try again and choose Allow when Google asks.");
          return;
        }

        panel.dataset.state = "sending";
        message.textContent = "Almost done…";
        label.textContent = "Almost done…";
        setDisabled(true);

        try {
          const response = await fetch("/oauth/google-drive/token", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({...tokenResponse, state: ${JSON.stringify(state)}}),
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) {
            showError("This sign-in page has expired. Go back to Lunarscribe and select Connect again.", false);
            return;
          }

          panel.dataset.state = "success";
          heading.textContent = "You are signed in";
          description.textContent = "Go back to Lunarscribe. Your files will start syncing in a moment.";
          message.textContent = "You can close this browser tab.";
        } catch {
          showError("Lunarscribe did not answer. Go back to the app and select Connect again.", false);
        }
      }

      function requestSignIn() {
        panel.dataset.state = "authorizing";
        message.textContent = "Finish in the Google window. If nothing opens, allow pop-ups for this page.";
        label.textContent = "Waiting for Google…";
        setDisabled(true);

        try {
          client.requestAccessToken({prompt: "select_account"});
        } catch {
          showError("The Google window could not open. Allow pop-ups for this page and try again.");
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
              ? "The Google window could not open. Allow pop-ups for this page and try again."
              : "The Google window was closed. You can try signing in again.")
          });
          panel.dataset.state = "ready";
          setDisabled(false);
          label.textContent = "Sign in with Google";
          message.textContent = "";
          button.onclick = requestSignIn;
        } catch {
          showError("Google sign-in could not start. Try again, or select Connect again in Lunarscribe.");
        }
      }

      function loadGoogleLibrary() {
        clearTimeout(loadTimeout);
        if (library) library.remove();
        panel.dataset.state = "loading";
        setDisabled(true);
        label.textContent = "Loading Google sign-in…";
        message.textContent = "Getting sign-in ready…";
        library = document.createElement("script");
        library.src = "https://accounts.google.com/gsi/client";
        library.onload = initializeGoogleClient;
        library.onerror = () => {
          clearTimeout(loadTimeout);
          showError("Google sign-in could not load. Check your internet connection and try again.");
        };
        button.onclick = loadGoogleLibrary;
        loadTimeout = setTimeout(() => {
          library.onload = null;
          library.onerror = null;
          library.remove();
          showError("Google sign-in is taking too long. Check your internet connection and try again.");
        }, 12000);
        document.head.appendChild(library);
      }

      loadGoogleLibrary();
    </script>`,
  );
}

/** Shown after the provider sends the browser back to Lunarscribe. */
export function createSignInResultPage(
  provider: OAuthProvider,
  isSuccess: boolean,
) {
  const { name } = PROVIDERS[provider];

  const layout = renderToStaticMarkup(
    <SignInCard
      provider={provider}
      state={isSuccess ? "success" : "failed"}
      heading={isSuccess ? "You are signed in" : "Sign-in did not finish"}
      description={
        isSuccess
          ? "Go back to Lunarscribe. Your files will start syncing in a moment."
          : `Nothing was changed. Go back to Lunarscribe and select Connect ${name} to try again.`
      }
    >
      <p data-part="note">You can close this tab.</p>
    </SignInCard>,
  );

  return createPage(
    isSuccess ? `${name} connected` : "Sign-in did not finish",
    layout,
  );
}
