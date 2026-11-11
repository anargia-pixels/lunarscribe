// Publish OTA updates to the update server's R2 bucket. CI runs `register` after a
// +mobile APK build and `publish` for a +mobile-ota tag, which also deletes old updates;
// maintainers run `pause` and `resume`. Usage: bun scripts/publish-update.ts <command> [runtime]
// `runtime` prints the runtime of this checkout.
import {
  createHash,
  createSign,
  createVerify,
  X509Certificate,
} from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import names from "@lunarscribe/infra/names.json";
import { mapConcurrent } from "@lunarscribe/utils/map-concurrent";
import {
  jsonArray,
  jsonBoolean,
  jsonField,
  jsonString,
  parseJson,
} from "@lunarscribe/utils/sync/json";
import { $ } from "bun";
import {
  assetKey,
  assetUrl,
  manifestKey,
  parseRuntimeRecord,
  RUNTIMES_PREFIX,
  runtimeKey,
  signatureKey,
  UPDATES_PREFIX,
  updateIdOfKey,
} from "update-server/storage";
import type { RuntimeRecord } from "update-server/storage";

import codeSigning from "../certs/code-signing.json";

// Settings
const PLATFORM = "android";

const ORIGIN = `https://${names.updatesDomain}`;

const PROJECT_ROOT = join(import.meta.dir, "..");

const CERTIFICATE_PATH = join(PROJECT_ROOT, codeSigning.certificate);

const CONTENT_TYPES = new Map([
  ["css", "text/css"],
  ["gif", "image/gif"],
  ["html", "text/html"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["js", "application/javascript"],
  ["json", "application/json"],
  ["otf", "font/otf"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["ttf", "font/ttf"],
  ["webp", "image/webp"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"],
  ["xml", "application/xml"],
]);

/** A required environment variable; CI sets each from a repository secret. */
function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Set ${name}.`);
  }

  return value;
}

// R2 through the Cloudflare API
/** The API URL of the updates bucket's objects. */
function objectsUrl() {
  return `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/r2/buckets/${names.updatesBucket}/objects`;
}

/** The API URL of one object in the updates bucket. */
function objectUrl(key: string) {
  return `${objectsUrl()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Call the Cloudflare API with the token from the environment. */
function callApi(url: string | URL, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}`,
    },
  });
}

/** Every key that starts with `prefix`, across all result pages. */
async function listKeys(prefix: string) {
  const url = new URL(objectsUrl());
  const keys: string[] = [];
  let cursor = "";

  url.searchParams.set("prefix", prefix);
  url.searchParams.set("per_page", "1000");

  do {
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await callApi(url);

    if (!response.ok) {
      throw new Error(`Listing ${prefix} failed (${response.status}).`);
    }

    const page = parseJson(await response.text());
    const info = jsonField(page, "result_info") ?? null;

    keys.push(
      ...jsonArray(page, "result").map((item) => jsonString(item, "key")),
    );
    cursor =
      info !== null && jsonBoolean(info, "is_truncated")
        ? jsonString(info, "cursor")
        : "";
  } while (cursor);

  return keys;
}

/** Read an object as text, or null when it does not exist. */
async function getObject(key: string) {
  const response = await callApi(objectUrl(key));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Reading ${key} failed (${response.status}).`);
  }

  return response.text();
}

async function putObject(
  key: string,
  body: Uint8Array | string,
  contentType: string,
) {
  const response = await callApi(objectUrl(key), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!response.ok) {
    throw new Error(`Writing ${key} failed (${response.status}).`);
  }
}

async function deleteObject(key: string) {
  const response = await callApi(objectUrl(key), { method: "DELETE" });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Deleting ${key} failed (${response.status}).`);
  }
}

async function readRecord(runtime: string) {
  const stored = await getObject(runtimeKey(PLATFORM, runtime));

  return stored === null ? null : parseRuntimeRecord(stored);
}

function writeRecord(runtime: string, record: RuntimeRecord) {
  return putObject(
    runtimeKey(PLATFORM, runtime),
    JSON.stringify(record),
    "application/json",
  );
}

// Expo
/** The runtime of the native code in this checkout. */
async function resolveRuntime() {
  const output =
    await $`bunx expo-updates runtimeversion:resolve --platform ${PLATFORM}`
      .cwd(PROJECT_ROOT)
      .text();

  return jsonString(parseJson(output), "runtimeVersion");
}

/**
 * Export the JS bundle and assets. Bundle splitting stays off: `expo export` renames
 * DOM component chunks to their MD5 without updating the names chunks load each
 * other by, so a split editor page fails to export and could not load its chunks.
 */
async function exportBundle(outputDirectory: string) {
  await $`bunx expo export --platform ${PLATFORM} --output-dir ${outputDirectory}`
    .cwd(PROJECT_ROOT)
    .env({
      ...process.env,
      EXPO_NO_BUNDLE_SPLITTING: "1",
      NODE_ENV: "production",
    });
}

/** The public app config, which expo-constants reads from the running update. */
async function publicConfig() {
  return parseJson(
    await $`bunx expo config --json --type public`.cwd(PROJECT_ROOT).text(),
  );
}

// Manifest
type ManifestAsset = {
  hash: string;
  key: string;
  contentType: string;
  fileExtension?: string;
  url: string;
};

type UpdateFile = ManifestAsset & { bytes: Uint8Array; name: string };

/** Hash one exported file as the manifest describes it. */
async function describeFile(
  exportDirectory: string,
  path: string,
  extension: string,
  updateId: string,
): Promise<UpdateFile> {
  const bytes = await Bun.file(join(exportDirectory, path)).bytes();
  const key = createHash("md5").update(bytes).digest("hex");
  const name = `${key}.${extension}`;

  return {
    bytes,
    name,
    hash: createHash("sha256").update(bytes).digest("base64url"),
    key,
    contentType: CONTENT_TYPES.get(extension) ?? "application/octet-stream",
    fileExtension: `.${extension}`,
    url: assetUrl(ORIGIN, updateId, name),
  };
}

/** The manifest fields of an update file, without its bytes. */
function toManifestAsset({ bytes: _bytes, name: _name, ...asset }: UpdateFile) {
  return asset;
}

/**
 * Sign the manifest with the release key and return the `expo-signature` value. Checks
 * the signature against the certificate in the APK, so a wrong secret fails here
 * instead of on devices.
 */
async function sign(manifest: string) {
  const signature = createSign("RSA-SHA256")
    .update(manifest)
    .sign(env("EXPO_UPDATES_PRIVATE_KEY"), "base64");

  const certificate = new X509Certificate(
    await Bun.file(CERTIFICATE_PATH).text(),
  );

  const isValid = createVerify("RSA-SHA256")
    .update(manifest)
    .verify(certificate.publicKey, signature, "base64");

  if (!isValid) {
    throw new Error(
      "EXPO_UPDATES_PRIVATE_KEY does not match certs/certificate.pem.",
    );
  }

  return `sig="${signature}", keyid="${codeSigning.keyid}", alg="rsa-v1_5-sha256"`;
}

// Cleanup
/**
 * Delete every update that no runtime record points to, except `superseded`. A device
 * that read the old manifest just before the switch can still download its files; the
 * next publish deletes it. Old runtimes keep their updates, since their APKs stay
 * installed.
 */
async function removeOldUpdates(superseded: string | null) {
  const recordKeys = await listKeys(RUNTIMES_PREFIX);

  const records = await mapConcurrent(recordKeys, 8, async (key) => {
    const stored = await getObject(key);
    const record = stored === null ? null : parseRuntimeRecord(stored);

    // An unreadable record could point to any update, so delete nothing.
    if (!record) {
      throw new Error(`The record ${key} is unreadable.`);
    }

    return record;
  });

  const kept = new Set([
    superseded,
    ...records.map((record) => record.updateId),
  ]);

  const unused = (await listKeys(UPDATES_PREFIX)).filter(
    (key) => !kept.has(updateIdOfKey(key)),
  );

  await mapConcurrent(unused, 8, deleteObject);
  console.log(`Deleted ${unused.length} files of old updates.`);
}

// Commands
/**
 * Record the runtime of a new APK, resolved before `expo prebuild`; keep its OTA
 * update and pause flag.
 */
async function register(runtime: string | undefined) {
  if (!runtime) {
    throw new Error("Pass the runtime the APK was built with.");
  }

  const existing = await readRecord(runtime);

  await writeRecord(runtime, {
    apkTag: env("RELEASE_TAG"),
    updateId: existing?.updateId ?? null,
    updateTag: existing?.updateTag ?? null,
    paused: existing?.paused ?? false,
  });
  console.log(`Registered runtime ${runtime}.`);
}

/** Export, sign and upload an update, then point its runtime at it. */
async function publish() {
  const tag = env("RELEASE_TAG");
  const runtime = await resolveRuntime();
  const record = await readRecord(runtime);

  if (!record) {
    throw new Error(
      `No APK release has runtime ${runtime}. The native code changed; release a +mobile tag.`,
    );
  }

  const exportDirectory = await mkdtemp(join(tmpdir(), "lunarscribe-update-"));

  try {
    await exportBundle(exportDirectory);

    // Describe: hash the bundle and every asset that metadata.json lists.
    const metadata = parseJson(
      await Bun.file(join(exportDirectory, "metadata.json")).text(),
    );

    const platform = jsonField(
      jsonField(metadata, "fileMetadata") ?? null,
      PLATFORM,
    );

    if (platform === undefined) {
      throw new Error(`The export has no ${PLATFORM} bundle.`);
    }

    const updateId = crypto.randomUUID();

    const launchFile = await describeFile(
      exportDirectory,
      jsonString(platform, "bundle"),
      "js",
      updateId,
    );

    const described = await mapConcurrent(
      jsonArray(platform, "assets"),
      8,
      (asset) =>
        describeFile(
          exportDirectory,
          jsonString(asset, "path"),
          jsonString(asset, "ext"),
          updateId,
        ),
    );

    // DOM components can share a file; list each one once.
    const files = [
      ...new Map(described.map((file) => [file.key, file])).values(),
    ];

    // Sign: the server returns these exact bytes, so serialize the manifest once.
    const { fileExtension: _launchExtension, ...launchAsset } =
      toManifestAsset(launchFile);

    const manifest = JSON.stringify({
      id: updateId,
      createdAt: new Date().toISOString(),
      runtimeVersion: runtime,
      launchAsset,
      assets: files.map(toManifestAsset),
      metadata: {},
      extra: { expoClient: await publicConfig() },
    });

    const signature = await sign(manifest);

    // Upload: files first, the runtime record last, so devices never see a partial update.
    await mapConcurrent([launchFile, ...files], 8, (file) =>
      putObject(assetKey(updateId, file.name), file.bytes, file.contentType),
    );
    await putObject(manifestKey(updateId), manifest, "application/json");
    await putObject(signatureKey(updateId), signature, "text/plain");
    // A new update ends a pause, since it is the fix for what was paused.
    await writeRecord(runtime, {
      ...record,
      updateId,
      updateTag: tag,
      paused: false,
    });
    console.log(`Published update ${updateId} for runtime ${runtime}.`);
  } finally {
    await rm(exportDirectory, { recursive: true, force: true });
  }

  // The update is live, so a failed cleanup only leaves files for the next publish.
  try {
    await removeOldUpdates(record.updateId);
  } catch (cause) {
    console.warn("Old updates were not deleted:", cause);
  }
}

/** Stop or restart serving the current update of `runtime`. */
async function setPaused(runtime: string | undefined, paused: boolean) {
  if (!runtime) {
    throw new Error("Pass the runtime to pause or resume.");
  }

  const record = await readRecord(runtime);

  if (!record) {
    throw new Error(`No APK release has runtime ${runtime}.`);
  }

  await writeRecord(runtime, { ...record, paused });
  console.log(`${paused ? "Paused" : "Resumed"} runtime ${runtime}.`);
}

const [command, runtime] = Bun.argv.slice(2);

if (command === "register") {
  await register(runtime);
} else if (command === "runtime") {
  console.log(await resolveRuntime());
} else if (command === "publish") {
  await publish();
} else if (command === "pause" || command === "resume") {
  await setPaused(runtime, command === "pause");
} else {
  throw new Error(
    "Usage: bun scripts/publish-update.ts runtime | register <runtime> | publish | pause <runtime> | resume <runtime>",
  );
}
