import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import appIcon from "../../../../../../assets/icons/32x32.png?inline";
import type { OAuthProvider } from "./oauth";

import styles from "./sign-in-page.css?inline";

// Provider marks
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
  state: "success" | "failed";
  heading: string;
  description: ReactNode;
  children?: ReactNode;
};

const MARK_CLASS = "size-16 place-items-center rounded-full border";

const NOTE_CLASS =
  "border-border text-muted-foreground mt-5 w-full border-t pt-4 text-xs";

/** One centered card: provider mark, outcome icon, heading, then controls. */
function SignInCard({
  provider,
  state,
  heading,
  description,
  children,
}: SignInCardProps) {
  return (
    <div className="flex w-full max-w-105 flex-col items-center">
      <header className="font-logo text-primary mb-6 flex items-center gap-2 text-2xl/none">
        <img src={appIcon} alt="" width={28} height={28} className="shrink-0" />
        <span>Lunarscribe</span>
      </header>
      {/* A finished sign-in swaps the provider mark for its outcome. */}
      <main
        data-state={state}
        className="group border-border bg-card flex w-full flex-col items-center rounded-2xl border px-5 pt-8 pb-6 text-center @2xl:px-8 @2xl:pt-10 @2xl:pb-8"
      >
        <div
          className={`${MARK_CLASS} border-border bg-background grid group-data-[state=failed]:hidden group-data-[state=success]:hidden`}
        >
          {PROVIDERS[provider].logo}
        </div>
        <div
          aria-hidden="true"
          className={`${MARK_CLASS} text-syntax-string hidden border-current group-data-[state=success]:grid`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <div
          aria-hidden="true"
          className={`${MARK_CLASS} text-destructive hidden border-current group-data-[state=failed]:grid`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl/snug font-semibold tracking-tight text-balance">
          {heading}
        </h1>
        <p className="text-muted-foreground mt-2.5 text-pretty">
          {description}
        </p>
        {children}
      </main>
      <footer className="text-muted-foreground mt-5 text-center text-xs">
        You can stop syncing anytime in Lunarscribe settings.
      </footer>
    </div>
  );
}

/** Wrap rendered markup in a page that needs only inline styles and images. */
function createPage(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} · Lunarscribe</title>
    <style>${styles}</style>
  </head>
  <body class="bg-background text-foreground @container grid min-h-svh place-items-center px-5 py-10 text-sm/relaxed antialiased">
    ${body}
  </body>
</html>`;
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
      <p className={NOTE_CLASS}>You can close this tab.</p>
    </SignInCard>,
  );

  return createPage(
    isSuccess ? `${name} connected` : "Sign-in did not finish",
    layout,
  );
}
