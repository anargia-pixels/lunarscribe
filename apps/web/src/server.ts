import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import {
  createServerEntry,
  type ServerEntry,
} from "@tanstack/react-start/server-entry";

/**
 * The landing and legal pages render the same HTML for everyone, so an edge may
 * hold one briefly. A deploy keys a new cache entry, so a fresh build is never
 * served from an older one.
 */
const SITE_CACHE_CONTROL = "public, max-age=0, s-maxage=300";

/** The editor and the OAuth window belong to one visitor and hold their state. */
const VISITOR_CACHE_CONTROL = "private, no-store";

const startHandler = createStartHandler(defaultStreamHandler);

/** Editor and OAuth paths render per visitor; everything else is public. */
function cacheControlFor(pathname: string): string {
  return pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/oauth/")
    ? VISITOR_CACHE_CONTROL
    : SITE_CACHE_CONTROL;
}

/**
 * Wraps the Start handler so every rendered response states how it may be
 * cached. Browsers revalidate the public pages on each visit, which keeps a
 * deployed change one round trip away, and never cache the editor's shell.
 */
export default createServerEntry({
  async fetch(request, ...rest) {
    const response = await startHandler(request, ...rest);

    // Only reads carry a cache; a server function call or a redirect that the
    // handler already marked keeps the header it was given.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return response;
    }

    if (response.headers.has("Cache-Control")) {
      return response;
    }

    const headers = new Headers(response.headers);

    // An error is worth keeping: a page that starts working should not wait out
    // a cached 404.
    headers.set(
      "Cache-Control",
      response.ok
        ? cacheControlFor(new URL(request.url).pathname)
        : VISITOR_CACHE_CONTROL,
    );

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  },
} satisfies ServerEntry);
