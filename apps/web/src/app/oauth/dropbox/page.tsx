import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { OAUTH_CHANNEL } from "@/lib/sync/oauth";
import type { OAuthCallback } from "@/lib/sync/oauth";

/** Dropbox redirects its sign-in pop-up here; the code goes back to the opening tab. */
export const Route = createFileRoute("/oauth/dropbox/")({
  ssr: false,
  component: DropboxCallback,
});

function DropboxCallback() {
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const channel = new BroadcastChannel(OAUTH_CHANNEL);

    channel.postMessage({
      state: parameters.get("state") ?? "",
      code: parameters.get("code"),
      error: parameters.get("error"),
    } satisfies OAuthCallback);
    channel.close();
    window.close();
  }, []);

  return (
    <p className="p-8 text-sm">
      Return to Lunarscribe to finish signing in. You can close this window.
    </p>
  );
}
