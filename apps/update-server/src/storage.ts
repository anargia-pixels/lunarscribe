import { jsonField, jsonString, parseJson } from "@lunarscribe/utils/sync/json";

/**
 * The R2 layout of OTA updates, shared by the update server and the publish script.
 *
 * - `runtimes/<platform>/<runtime>.json`: the runtime's record (see `RuntimeRecord`)
 * - `updates/<id>/manifest.json`: the manifest bytes CI signed
 * - `updates/<id>/manifest.sig`: the `expo-signature` header value
 * - `updates/<id>/assets/<name>`: the bundle and assets, named by content hash
 */

/** An APK runtime and the OTA update it gets, if any. */
export type RuntimeRecord = {
  apkTag: string; // the +mobile release whose APK has this runtime
  updateId: string | null; // the current OTA update
  updateTag: string | null; // the +mobile-ota release that published it
  paused: boolean; // when true, the server reports no update
};

export const RUNTIMES_PREFIX = "runtimes/";

export const UPDATES_PREFIX = "updates/";

export function runtimeKey(platform: string, runtime: string) {
  return `${RUNTIMES_PREFIX}${platform}/${encodeURIComponent(runtime)}.json`;
}

export function manifestKey(updateId: string) {
  return `${UPDATES_PREFIX}${updateId}/manifest.json`;
}

export function signatureKey(updateId: string) {
  return `${UPDATES_PREFIX}${updateId}/manifest.sig`;
}

export function assetKey(updateId: string, name: string) {
  return `${UPDATES_PREFIX}${updateId}/assets/${name}`;
}

/** The update that a key under `UPDATES_PREFIX` belongs to. */
export function updateIdOfKey(key: string) {
  return key.slice(UPDATES_PREFIX.length).split("/")[0] ?? "";
}

/** The public URL of an asset; `parseAssetPath` reads it back. */
export function assetUrl(origin: string, updateId: string, name: string) {
  return `${origin}/assets/${updateId}/${name}`;
}

/** The R2 key of an `assetUrl` path, or null for any other path. */
export function parseAssetPath(pathname: string) {
  const [root, updateId, name, ...rest] = pathname.split("/").slice(1);

  return root === "assets" && updateId && name && rest.length === 0
    ? assetKey(updateId, name)
    : null;
}

/** Parse a stored record; returns null for anything malformed. */
export function parseRuntimeRecord(serialized: string): RuntimeRecord | null {
  try {
    const stored = parseJson(serialized);

    return {
      apkTag: jsonString(stored, "apkTag", true),
      updateId: jsonString(stored, "updateId", true) || null,
      updateTag: jsonString(stored, "updateTag", true) || null,
      paused: jsonField(stored, "paused") === true,
    };
  } catch {
    return null;
  }
}
