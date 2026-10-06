import { GOOGLE_REDIRECT_PREFIX } from "@/lib/sync/google-redirect";

/** Paths of the sign-in redirects that the system browser hands back to the app. */
const OAUTH_REDIRECTS = ["lunarscribe://oauth/", GOOGLE_REDIRECT_PREFIX];

/**
 * Sign-in redirects belong to the browser session waiting for them, not to a screen;
 * keep the current screen, or open the files screen on a cold start.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  if (OAUTH_REDIRECTS.some((prefix) => path.startsWith(prefix))) {
    return initial ? "/" : null;
  }

  return path;
}
