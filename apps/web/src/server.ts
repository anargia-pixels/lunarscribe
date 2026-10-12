import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import {
  createServerEntry,
  type ServerEntry,
} from "@tanstack/react-start/server-entry";

/**
 * The site pages render the same HTML for everyone: a browser revalidates on
 * each visit and an edge may hold one for five minutes.
 */
const SITE_CACHE_CONTROL = "public, max-age=0, s-maxage=300";

/** The editor, the OAuth window and every error belong to a single request. */
const PRIVATE_CACHE_CONTROL = "private, no-store";

const startHandler = createStartHandler(defaultStreamHandler);

/** Editor and OAuth paths render per visitor; every other path is public. */
function cacheControlFor(pathname: string): string {
  return pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/oauth/")
    ? PRIVATE_CACHE_CONTROL
    : SITE_CACHE_CONTROL;
}

/**
 * Wraps the Start handler so every rendered response states how it may be
 * cached. The prerendered pages answer from the static assets before this entry
 * runs, so it serves the editor and the few routes they do not cover.
 */
export default createServerEntry({
  async fetch(request, ...rest) {
    const response = await startHandler(request, ...rest);

    // Only reads carry a cache directive.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return response;
    }

    // Keep a header the handler set itself.
    if (response.headers.has("Cache-Control")) {
      return response;
    }

    const headers = new Headers(response.headers);

    // An error is never cached, so a new page waits out no stale 404.
    headers.set(
      "Cache-Control",
      response.ok
        ? cacheControlFor(new URL(request.url).pathname)
        : PRIVATE_CACHE_CONTROL,
    );

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  },
} satisfies ServerEntry);
