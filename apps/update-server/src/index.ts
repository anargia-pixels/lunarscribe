import type { UpdateServerEnv } from "@lunarscribe/infra/alchemy.run";

import {
  manifestKey,
  parseAssetPath,
  parseRuntimeRecord,
  runtimeKey,
  signatureKey,
} from "./storage";

// Expo Updates protocol
/** expo-updates rejects a manifest response without these headers. */
const PROTOCOL_HEADERS = {
  "expo-protocol-version": "1",
  "expo-sfv-version": "0",
  "cache-control": "private, max-age=0",
};

const PLATFORMS = new Set(["android", "ios"]);

/** No update for this runtime; protocol 1 allows an empty multipart response. */
function noUpdate() {
  return new Response(null, { status: 204, headers: PROTOCOL_HEADERS });
}

/** A multipart response with the manifest and its code-signing signature. */
function manifestResponse(manifest: string, signature: string) {
  const boundary = `update-${crypto.randomUUID()}`;

  const body = [
    `--${boundary}`,
    'content-disposition: form-data; name="manifest"',
    "content-type: application/json; charset=utf-8",
    `expo-signature: ${signature}`,
    "",
    manifest,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      ...PROTOCOL_HEADERS,
      "content-type": `multipart/mixed; boundary=${boundary}`,
    },
  });
}

// Request handlers
/** The current update for the app's platform and runtime, if any. */
async function getManifest(request: Request, env: UpdateServerEnv) {
  const platform = request.headers.get("expo-platform") ?? "";
  const runtime = request.headers.get("expo-runtime-version");

  if (!PLATFORMS.has(platform)) {
    return new Response("Unsupported platform", { status: 400 });
  }

  if (!runtime) {
    return new Response("Missing runtime version", { status: 400 });
  }

  const stored = await env.UPDATES.get(runtimeKey(platform, runtime));
  const record = stored && parseRuntimeRecord(await stored.text());

  if (!record || record.paused || !record.updateId) {
    console.log(platform, runtime, "no-update");

    return noUpdate();
  }

  const [manifest, signature] = await Promise.all([
    env.UPDATES.get(manifestKey(record.updateId)),
    env.UPDATES.get(signatureKey(record.updateId)),
  ]);

  if (!manifest || !signature) {
    console.log(platform, runtime, "missing", record.updateId);

    return new Response("Update unavailable", { status: 502 });
  }

  console.log(platform, runtime, record.updateId);

  // Return the exact bytes CI signed; a re-serialized manifest fails the check.
  return manifestResponse(await manifest.text(), await signature.text());
}

/** One file of an update; its name holds its hash, so it never changes. */
async function getAsset(key: string, env: UpdateServerEnv) {
  const object = await env.UPDATES.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      etag: object.httpEtag,
    },
  });
}

export default {
  async fetch(request: Request, env: UpdateServerEnv) {
    const { pathname } = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (pathname === "/manifest") {
      return getManifest(request, env);
    }

    const asset = parseAssetPath(pathname);

    if (asset) {
      return getAsset(asset, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<UpdateServerEnv>;
