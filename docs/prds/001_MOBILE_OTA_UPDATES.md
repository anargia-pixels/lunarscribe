# Mobile OTA updates

The Android build of the mobile app gets new JavaScript (JS) code and assets without a new
APK. An OTA (over-the-air) update is a signed set of JS bundle and asset files that the
app downloads in the background. The app uses the update on the next cold start. A cold
start is an app launch after the operating system stopped the app process.

Today, every change to the mobile app needs a new APK. The user must find the GitHub
release, download the APK and install it. With this feature, a JS-only fix gets to users
on their next app launch after one tag push.

## Terms

Use these terms in code, docs and conversation. Add each term to
[GLOSSARY.md](../../GLOSSARY.md) under "Product" in the same change that adds
`expo-updates`.

**Mobile app**: The Expo React Native app in `apps/mobile`. _Avoid_: native app, phone app

**OTA update**: A signed set of JS bundle and asset files for one runtime. The mobile app
downloads it and uses it on the next cold start. _Avoid_: hot update, patch, live update

**Runtime**: The native code contract of an APK. Its value is a fingerprint: a hash of the
native dependencies and native configuration. An OTA update applies only to an APK with
the same runtime. _Avoid_: native version, binary version

**Update server**: The Cloudflare Worker in `apps/ota-worker`. It tells the mobile app
which OTA update to use. It does not store files and does not hold the signing key.
_Avoid_: OTA backend, CDN

**OTA index**: The file `ota-index.json` on the GitHub release `ota-index`. It maps each
runtime to its APK release and its current OTA update. _Avoid_: registry, update database

## Outcome

- A `+mobile-ota` tag publishes an OTA update. It does not build an APK.
- An installed APK with the same runtime downloads that OTA update when it starts.
- The installed APK uses that OTA update on the next cold start. The user sees no prompt.
- The app rejects an OTA update that does not have a valid signature from the release key.
- Hosting costs nothing at the current scale.

## Release tags

The tag suffix selects the release type. All three tag types build and publish the desktop
app.

| Tag                   | Desktop app | APK | OTA update | OTA index change                     |
| --------------------- | ----------- | --- | ---------- | ------------------------------------ |
| `v0.13.22`            | Yes         | No  | No         | None                                 |
| `v0.13.22+mobile`     | Yes         | Yes | No         | Adds the runtime of the APK          |
| `v0.13.22+mobile-ota` | Yes         | No  | Yes        | Sets the OTA update for that runtime |

A `+mobile` tag does not publish an OTA update. Its APK already contains the JS code of
that commit. When a `+mobile` tag registers a runtime that already has an OTA update, the
workflow keeps that OTA update in the OTA index.

## Scope

In scope:

- Android only.
- JS bundle and asset updates through `expo-updates`. This includes the code of the DOM
  components `src/components/markdown-dom.tsx` and `src/components/drawing-dom.tsx`.
- The fix for the `expo export` failure (Phase 0).
- Code signing of each OTA update manifest.
- The update server on Cloudflare Workers (`workers.dev` subdomain, free plan).
- File storage on GitHub releases.
- Changes to `.github/workflows/release.yml` for the three tag types.
- Changes to `docs/002-release-guide.md`, `GLOSSARY.md` and `privacy-policy.md`.

Out of scope:

- iOS. The repository has no iOS build in CI. The design does not block iOS later: the OTA
  index has one key per platform.
- In-app UI for updates: no prompt, no progress indicator, no "check now" button, no
  update setting.
- An immediate reload after download. The app does not call `Updates.reloadAsync()`.
- Staged rollouts (a percentage of users), channels and branches.
- EAS Update. EAS code signing needs the Production plan at $199 per month. The free plan
  has no code signing.
- A custom domain for the update server.
- Automatic deploys of the update server. A maintainer deploys it by hand.
- Delta (patch) downloads. The app downloads each changed file in full.
- Updates for APKs that do not contain `expo-updates`. Version 0.13.21 and older never get
  OTA updates.
- `install.sh` changes. Its pinned-version pattern `^v[0-9]+\.[0-9]+\.[0-9]+$` rejects
  tags with a suffix. `install.sh` installs only the desktop app, so no change is
  necessary.

## How it works

```text
            tag push v0.13.23+mobile-ota
                        |
                        v
  GitHub Actions: expo export -> manifest -> sign -> upload release assets
                        |                                   |
                        v                                   v
         ota-index release: ota-index.json      v0.13.23+mobile-ota release:
         android[runtime].update = tag            ota-android-manifest.json
                        ^                          ota-android-manifest.json.sig
                        |                          ota-android-<key>.<ext> ...
                        | (cached 60 s)                     ^
                        |                                   |
  mobile app --GET /manifest--> update server --fetch-------+
      |                         (Cloudflare Worker)
      |  <-- manifest bytes + expo-signature header
      |
      +--GET asset URLs--> github.com/.../releases/download/... (direct)
```

1. On launch, `expo-updates` sends `GET <update server>/manifest` with the `expo-platform`
   and `expo-runtime-version` headers.
2. The update server reads the OTA index. It finds the OTA update tag for that runtime.
3. The update server fetches the manifest and its signature from that release. It returns
   the manifest bytes without change, plus the signature in the `expo-signature` header.
4. `expo-updates` verifies the signature with the certificate in the APK.
5. `expo-updates` compares `createdAt` with the running update. It downloads the update
   only when the new `createdAt` is later.
6. `expo-updates` downloads each asset straight from GitHub and checks its SHA-256 hash.
7. On the next cold start, the app runs the new bundle.

Why the app does not read GitHub directly: `expo-updates` 57 requires the
`expo-protocol-version` response header. Without it, the client throws "Legacy manifests
are no longer supported". GitHub release downloads cannot set response headers. The update
server adds the headers.

## Phase 0: fix `expo export` (blocking)

Do not start Phase 1 before Phase 0 is complete.

`expo-updates` serves the output of `expo export`. Today this command fails:

```sh
cd apps/mobile
NODE_ENV=production bunx expo export --platform android \
  --output-dir /tmp/ota-export --dump-assetmap
```

The Android bundle builds (4476 modules). The DOM component bundle for
`src/components/markdown-dom.tsx` then fails in `exportDomComponentAsync` (`@expo/cli`
`serializeHtml.js`):

```text
Error: Asset not found: _expo/static/js/web/__common-472d9850854ca5655526c2af92f4968f.js
```

The probable cause is the web resolver override in `apps/mobile/metro.config.js`. It loads
the single-file Mermaid build as a lazy chunk and sets `unstable_conditionsByPlatform` for
web to `browser` and `production`. The DOM component export then expects a common chunk
that the serializer does not emit.

Requirements:

1. `expo export --platform android` exits with code 0 from `apps/mobile` with
   `NODE_ENV=production`.
2. The export output contains an HTML file and its JS for each of the two DOM components.
3. `dist/metadata.json` lists the DOM component files under `fileMetadata.android.assets`.
4. A release APK built after the fix still opens the markdown editor and the drawing
   editor.
5. The `android` job in `release.yml` runs the export command after the APK build. The job
   fails when the export fails.

Do not remove the Mermaid lazy chunk to fix the export. The lazy chunk keeps Mermaid out
of the initial DOM component load.

## Phase 1: mobile app changes

### Install `expo-updates`

```sh
cd apps/mobile
bunx expo install expo-updates
```

`expo install` selects the version for Expo SDK 57. If `bunfig.toml` blocks the version
because it is newer than 7 days, add the package to `minimumReleaseAgeExcludes`.

### App config

Add the `updates` and `runtimeVersion` keys and the `expo-updates` plugin to
`apps/mobile/app.config.ts`:

```ts
/**
 * The update server. Each launch asks it for an OTA update for this runtime.
 * Set the workers.dev subdomain after the first `wrangler deploy`.
 */
const UPDATE_SERVER_URL = "https://lunarscribe-ota.<subdomain>.workers.dev/manifest";

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => ({
  ...config,
  // ...existing keys...
  // The runtime is a fingerprint of the native code. An OTA update applies only to
  // an APK with the same fingerprint. fingerprint.config.js keeps the app version out.
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    url: UPDATE_SERVER_URL,
    checkAutomatically: "ON_LOAD",
    // Start with the cached or embedded bundle at once. A new update applies on the
    // next cold start.
    fallbackToCacheTimeout: 0,
    codeSigningCertificate: "./certs/certificate.pem",
    codeSigningMetadata: { keyid: "main", alg: "rsa-v1_5-sha256" },
  },
  plugins: [
    // ...existing plugins...
    "expo-updates",
  ],
});
```

Behavior:

- `expo-updates` is off in development builds and in Expo Go. `bun run dev` does not
  change.
- When the update server fails or the device is offline, the app starts with the newest
  update it has. The user sees no error.
- The app has no `Updates.*` calls in `src/`.

### Keep the app version out of the runtime

`@expo/fingerprint` 0.20.13 includes `version`, `android.versionCode` and
`ios.buildNumber` in the fingerprint by default. Each release changes the version, so each
release would get a new runtime and no OTA update could apply. Create
`apps/mobile/fingerprint.config.js`:

```js
const { SourceSkips } = require("expo/fingerprint");

/** @type {import('expo/fingerprint').Config} */
const config = {
  // The app version changes with each release. Without this skip, every release
  // would get a new runtime and OTA updates could not reach older APKs.
  sourceSkips:
    SourceSkips.ExpoConfigVersions |
    SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun,
};

module.exports = config;
```

`PackageJsonAndroidAndIosScriptsIfNotContainRun` is the default skip. Keep it.

Check:

```sh
cd apps/mobile
bunx expo-updates runtimeversion:resolve --platform android
# Change "version" in app.config.ts, then run the command again.
# The runtimeVersion value must not change.
```

### Code signing key

A maintainer creates the key pair one time:

```sh
cd apps/mobile
bunx expo-updates codesigning:generate \
  --key-output-directory ../../../lunarscribe-ota-keys \
  --certificate-output-directory certs \
  --certificate-validity-duration-years 10 \
  --certificate-common-name "Lunarscribe"
```

- Commit `apps/mobile/certs/certificate.pem`.
- Never commit `private-key.pem` or `public-key.pem`. The output directory is outside the
  repository for this reason.
- Store the content of `private-key.pem` in the GitHub Actions secret
  `EXPO_UPDATES_PRIVATE_KEY`.
- Keep an offline copy of `private-key.pem` in the maintainer's password manager.

If the private key is lost, no OTA update can reach the APKs that contain the old
certificate. Those users must install a new APK.

## Phase 2: update server

### Workspace

Create the workspace `apps/ota-worker`:

```text
apps/ota-worker/
  package.json
  tsconfig.json
  wrangler.jsonc
  src/index.ts
```

`package.json`:

```json
{
  "name": "ota-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "catalog:",
    "typescript": "catalog:",
    "wrangler": "catalog:"
  }
}
```

Add `wrangler` and `@cloudflare/workers-types` to the catalog in the root `package.json`.
`.oxlintrc.json` already ignores `**/wrangler.jsonc` and `**/.wrangler`.

`wrangler.jsonc`:

```jsonc
{
  "name": "lunarscribe-ota",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "workers_dev": true,
  "observability": { "enabled": true },
}
```

The worker has no secrets, no bindings and no storage.

### OTA index schema

```ts
type RuntimeEntry = {
  /** The +mobile release whose APK has this runtime. */
  apkTag: string;
  /** The +mobile-ota release that holds the current OTA update, or null. */
  updateTag: string | null;
  /** When true, the update server returns "no update" for this runtime. */
  paused: boolean;
};

type OtaIndex = {
  schemaVersion: 1;
  /** Runtime value to entry. */
  android: Record<string, RuntimeEntry>;
};
```

Example:

```json
{
  "schemaVersion": 1,
  "android": {
    "8d1f6c0e2b7a4c39b5e0f1a2d3c4b5a69788f0e1": {
      "apkTag": "v0.13.22+mobile",
      "updateTag": "v0.13.24+mobile-ota",
      "paused": false
    }
  }
}
```

### Request handling

`src/index.ts` handles one route: `GET /manifest`.

| Condition                                                     | Response                                                |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Path is not `/manifest` or method is not `GET`                | 404                                                     |
| `expo-platform` is not `android`                              | 400 `Unsupported platform`                              |
| `expo-runtime-version` is missing                             | 400 `Missing runtime version`                           |
| No OTA index was ever loaded                                  | 503                                                     |
| Runtime not in the index, `paused` is true, or no `updateTag` | 204 with protocol headers                               |
| Manifest or signature fetch fails                             | 502                                                     |
| Otherwise                                                     | 200, manifest bytes, protocol headers, `expo-signature` |

The client treats 4xx, 5xx and network errors as a failed check. It starts with the newest
update it has and checks again on the next launch.

```ts
const DOWNLOADS = "https://github.com/anargia-pixels/lunarscribe/releases/download";
const INDEX_URL = `${DOWNLOADS}/ota-index/ota-index.json`;
const INDEX_TTL_MS = 60_000;

// expo-updates rejects a manifest response without these headers.
const PROTOCOL_HEADERS = {
  "expo-protocol-version": "1",
  "expo-sfv-version": "0",
  "cache-control": "private, max-age=0",
};

/** The last good OTA index in this isolate. A failed refresh keeps it. */
let cachedIndex: OtaIndex | undefined;
let cachedAt = 0;

async function loadIndex() {
  if (cachedIndex && Date.now() - cachedAt < INDEX_TTL_MS) return cachedIndex;

  const response = await fetch(INDEX_URL);
  if (response.ok) {
    cachedIndex = await response.json();
    cachedAt = Date.now();
  }

  return cachedIndex;
}

function releaseAsset(tag: string, name: string) {
  return `${DOWNLOADS}/${encodeURIComponent(tag)}/${name}`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/manifest" || request.method !== "GET") {
      return new Response("Not found", { status: 404 });
    }

    const platform = request.headers.get("expo-platform");
    const runtime = request.headers.get("expo-runtime-version");
    if (platform !== "android") {
      return new Response("Unsupported platform", { status: 400 });
    }
    if (!runtime) return new Response("Missing runtime version", { status: 400 });

    const index = await loadIndex();
    if (!index) return new Response("OTA index unavailable", { status: 503 });

    const entry = index.android[runtime];
    if (!entry || entry.paused || !entry.updateTag) {
      log(runtime, "no-update");
      return new Response(null, { status: 204, headers: PROTOCOL_HEADERS });
    }

    const [manifest, signature] = await Promise.all([
      fetch(releaseAsset(entry.updateTag, "ota-android-manifest.json")),
      fetch(releaseAsset(entry.updateTag, "ota-android-manifest.json.sig")),
    ]);
    if (!manifest.ok || !signature.ok) {
      log(runtime, "fetch-failed");
      return new Response("Update unavailable", { status: 502 });
    }

    log(runtime, entry.updateTag);
    // Return the exact bytes that CI signed. A re-serialized body fails the check.
    return new Response(await manifest.arrayBuffer(), {
      headers: {
        ...PROTOCOL_HEADERS,
        "content-type": "application/json",
        "expo-signature": (await signature.text()).trim(),
      },
    });
  },
};
```

Rules:

- The update server never parses or changes the manifest body.
- The update server logs one line per request: runtime and result. It logs no IP address
  and no other header.
- `fetch` follows the GitHub redirect to `objects.githubusercontent.com`.
- Each isolate keeps its own cache. A change to the OTA index reaches all users within
  about 60 seconds.

### Deploy

```sh
bunx wrangler login
bun run deploy --filter=ota-worker
```

After the first deploy, put the `workers.dev` URL into `UPDATE_SERVER_URL` in
`app.config.ts`. A changed URL changes the runtime, so set it before the first `+mobile`
release with `expo-updates`.

Check:

```sh
curl -i https://lunarscribe-ota.<subdomain>.workers.dev/manifest \
  -H "expo-platform: android" -H "expo-runtime-version: unknown"
# Expect: HTTP 204, expo-protocol-version: 1
```

## Phase 3: release workflow

### OTA index bootstrap

The `ota-index` release is a prerelease that is not "latest". `install.sh` reads
`releases/latest`, which never returns a prerelease. The tag `ota-index` does not match
`v*`, so it does not start the release workflow.

```sh
echo '{"schemaVersion":1,"android":{}}' > ota-index.json
gh release create ota-index ota-index.json --prerelease --latest=false \
  --title "OTA index" --notes "Maps Android runtimes to OTA updates. CI edits this release."
```

The `register` job (below) also creates the release when it does not exist.

### Release type

Add one step to each job that reads the tag. It is the only place that parses the suffix:

```sh
case "$RELEASE_TAG" in
  *+mobile-ota) kind=mobile-ota ;;
  *+mobile) kind=mobile ;;
  *) kind=desktop ;;
esac
```

Job conditions use the expression form, because a job `if` cannot read the `env` context:

```yaml
# +mobile builds the APK
if: endsWith(inputs.tag || github.ref_name, '+mobile')
# +mobile-ota publishes an OTA update
if: endsWith(inputs.tag || github.ref_name, '+mobile-ota')
```

`endsWith(..., '+mobile')` is false for `+mobile-ota`.

### Version checks

The desktop version check removes either suffix:

```sh
version=$(jq -r .version apps/desktop/package.json)
release_version=${RELEASE_TAG#v}
release_version=${release_version%+mobile-ota}
release_version=${release_version%+mobile}
test "$release_version" = "$version"
```

The `ota` job checks the mobile version:

```sh
version=$(jq -r .version apps/mobile/package.json)
test "$RELEASE_TAG" = "v$version+mobile-ota"
```

### `android` job additions (`+mobile`)

After the APK build:

1. Resolve the runtime on a clean checkout of the same commit and after the build. Fail
   when the two values differ. A difference means the build changed a fingerprint input.

   ```sh
   # Before `expo prebuild`
   bunx expo-updates runtimeversion:resolve --platform android \
     | jq -r .runtimeVersion > "$RUNNER_TEMP/runtime-before.txt"
   # After the APK build
   bunx expo-updates runtimeversion:resolve --platform android \
     | jq -r .runtimeVersion > runtime-android.txt
   diff "$RUNNER_TEMP/runtime-before.txt" runtime-android.txt
   ```

2. Run `expo export` (Phase 0). The job fails when it fails.
3. Upload `runtime-android.txt` as the artifact `runtime-android` for the `register` job.

### `ota` job (`+mobile-ota`)

```yaml
ota:
  if: endsWith(inputs.tag || github.ref_name, '+mobile-ota')
  runs-on: ubuntu-24.04
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: 1.3.14
    - name: Check the release version
      run: |
        version=$(jq -r .version apps/mobile/package.json)
        test "$RELEASE_TAG" = "v$version+mobile-ota"
    - run: bun install --frozen-lockfile
    - name: Resolve the runtime
      working-directory: apps/mobile
      run: |
        bunx expo-updates runtimeversion:resolve --platform android \
          | jq -r .runtimeVersion > ../../runtime-android.txt
    - name: Check that an APK has this runtime
      env:
        GH_TOKEN: ${{ github.token }}
      run: |
        gh release download ota-index --pattern ota-index.json --dir "$RUNNER_TEMP"
        runtime=$(cat runtime-android.txt)
        if ! jq -e --arg r "$runtime" '.android[$r]' "$RUNNER_TEMP/ota-index.json" >/dev/null; then
          echo "::error::No APK release has runtime $runtime. The native code changed. Release a +mobile tag."
          exit 1
        fi
    - name: Export the bundle
      working-directory: apps/mobile
      env:
        NODE_ENV: production
      run: bunx expo export --platform android --output-dir dist-ota
    - name: Create the manifest
      run: >
        bun apps/mobile/scripts/create-ota-manifest.ts apps/mobile/dist-ota "$(cat
        runtime-android.txt)" ota
    - name: Sign the manifest
      env:
        EXPO_UPDATES_PRIVATE_KEY: ${{ secrets.EXPO_UPDATES_PRIVATE_KEY }}
      run: |
        key="$RUNNER_TEMP/private-key.pem"
        printf '%s\n' "$EXPO_UPDATES_PRIVATE_KEY" > "$key"
        openssl dgst -sha256 -sign "$key" -out "$RUNNER_TEMP/manifest.sig" \
          ota/ota-android-manifest.json
        rm "$key"
        # Fail when the secret does not match the certificate in the APK.
        openssl x509 -pubkey -noout -in apps/mobile/certs/certificate.pem \
          > "$RUNNER_TEMP/public-key.pem"
        openssl dgst -sha256 -verify "$RUNNER_TEMP/public-key.pem" \
          -signature "$RUNNER_TEMP/manifest.sig" ota/ota-android-manifest.json
        sig=$(base64 -w0 "$RUNNER_TEMP/manifest.sig")
        printf 'sig="%s", keyid="main", alg="rsa-v1_5-sha256"' "$sig" \
          > ota/ota-android-manifest.json.sig
    # One directory per artifact keeps the files flat when publish merges them.
    - uses: actions/upload-artifact@v4
      with:
        name: ota-android
        path: ota/
        if-no-files-found: error
    - uses: actions/upload-artifact@v4
      with:
        name: runtime-android
        path: runtime-android.txt
        if-no-files-found: error
```

### Manifest script

`apps/mobile/scripts/create-ota-manifest.ts` takes three arguments: the export directory,
the runtime and the output directory. It writes:

- `ota-android-manifest.json`
- one file per launch asset and asset, named `ota-android-<key><fileExtension>`

Input: `dist-ota/metadata.json` from `expo export`:

```json
{
  "version": 0,
  "bundler": "metro",
  "fileMetadata": {
    "android": {
      "bundle": "_expo/static/js/android/entry-1a2b3c.hbc",
      "assets": [{ "path": "assets/5f4dcc3b5aa765d61d8327deb882cf99", "ext": "ttf" }]
    }
  }
}
```

Output manifest:

```json
{
  "id": "0b5d3e0e-7d3f-4b7a-9a43-0f3c2f4a8e11",
  "createdAt": "2026-10-20T09:15:02.000Z",
  "runtimeVersion": "8d1f6c0e2b7a4c39b5e0f1a2d3c4b5a69788f0e1",
  "launchAsset": {
    "hash": "base64url-sha256-of-the-bundle",
    "key": "md5-hex-of-the-bundle",
    "contentType": "application/javascript",
    "fileExtension": ".bundle",
    "url": "https://github.com/anargia-pixels/lunarscribe/releases/download/v0.13.24%2Bmobile-ota/ota-android-<key>.bundle"
  },
  "assets": [
    {
      "hash": "base64url-sha256-of-the-file",
      "key": "5f4dcc3b5aa765d61d8327deb882cf99",
      "contentType": "font/ttf",
      "fileExtension": ".ttf",
      "url": "https://github.com/anargia-pixels/lunarscribe/releases/download/v0.13.24%2Bmobile-ota/ota-android-5f4dcc3b5aa765d61d8327deb882cf99.ttf"
    }
  ],
  "metadata": {},
  "extra": { "expoClient": {} }
}
```

Field rules:

- `id`: `crypto.randomUUID()`.
- `createdAt`: the time of the run, `new Date().toISOString()`. The client applies an
  update only when this time is later than the running update.
- `runtimeVersion`: the second argument.
- `hash`: SHA-256 of the file bytes, base64url without padding. The client checks it after
  the download.
- `key`: MD5 of the file bytes as hex.
- `contentType`: from the file extension. Use `application/javascript` for the bundle and
  `application/octet-stream` for an unknown extension. The client does not check it.
- `url`: `<downloads>/<encodeURIComponent(tag)>/ota-android-<key><fileExtension>`. The tag
  comes from `RELEASE_TAG`.
- `extra.expoClient`: the output of `bunx expo config --json --type public` from
  `apps/mobile`. `expo-constants` reads it from the running update.
- Write the manifest with `JSON.stringify(manifest)` once. Do not format or rewrite it
  after signing.
- Exit with an error when `metadata.json` has no `fileMetadata.android`, when a listed
  file is missing, or when the total file count exceeds 900. GitHub allows 1000 assets per
  release.

```ts
const [exportDir, runtimeVersion, outDir] = Bun.argv.slice(2);
const tag = process.env.RELEASE_TAG;
// ...validate arguments and tag, read metadata.json...

async function describeFile(path: string, fileExtension: string, contentType: string) {
  const bytes = new Uint8Array(await Bun.file(`${exportDir}/${path}`).arrayBuffer());
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("base64url");
  const key = new Bun.CryptoHasher("md5").update(bytes).digest("hex");
  const name = `ota-android-${key}${fileExtension}`;
  await Bun.write(`${outDir}/${name}`, bytes);

  return {
    hash,
    key,
    contentType,
    fileExtension,
    url: `${DOWNLOADS}/${encodeURIComponent(tag)}/${name}`,
  };
}
```

The repository's oxlint rules apply to this script, including `anti-slop/*`.

### `publish` job

- `needs: [check, build, android, ota]`.
- The `if` accepts `success` or `skipped` for both `android` and `ota`.
- `download-artifact` with `merge-multiple: true` already puts the OTA files in
  `release/`. Upload them with the desktop assets.
- `sha256sums.txt` keeps the `lunarscribe-*` pattern. OTA files have their own hashes in
  the manifest.
- Delete `release/runtime-android.txt` before the upload. It is not a release asset.

### `register` job

This job is the only writer of the OTA index.

```yaml
register:
  needs: [publish, android, ota]
  if: >
    !cancelled() && needs.publish.result == 'success' && (needs.android.result ==
    'success' || needs.ota.result == 'success')
  runs-on: ubuntu-24.04
  timeout-minutes: 5
  # One writer at a time. Push one mobile tag and wait for this job before the next.
  concurrency:
    group: ota-index
    cancel-in-progress: false
  permissions:
    contents: write
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: runtime-android
        path: artifacts
    - name: Update the OTA index
      env:
        GH_TOKEN: ${{ github.token }}
        GH_REPO: ${{ github.repository }}
      run: |
        runtime=$(cat artifacts/runtime-android.txt)
        if ! gh release download ota-index --pattern ota-index.json --dir .; then
          echo '{"schemaVersion":1,"android":{}}' > ota-index.json
          gh release create ota-index --prerelease --latest=false \
            --title "OTA index" --notes "Maps Android runtimes to OTA updates. CI edits this release."
        fi
        case "$RELEASE_TAG" in
          *+mobile-ota)
            jq --arg r "$runtime" --arg t "$RELEASE_TAG" \
              '.android[$r].updateTag = $t' ota-index.json > next.json ;;
          *+mobile)
            # Keep an existing OTA update and pause flag for this runtime.
            jq --arg r "$runtime" --arg t "$RELEASE_TAG" \
              '.android[$r] = ({updateTag: null, paused: false} + .android[$r] + {apkTag: $t})' \
              ota-index.json > next.json ;;
        esac
        # The asset name comes from the file name.
        mv next.json ota-index.json
        gh release upload ota-index ota-index.json --clobber
```

A failed `register` job leaves the OTA index unchanged. Re-run the job. A re-run of an OTA
release writes the same `updateTag`.

## Rollback and pause

The client applies only an update with a later `createdAt`. To point the OTA index at an
older release has no effect on devices that already have the newer update.

To roll back:

1. Revert the bad commit on `main`.
2. Bump the version in the three version files, as `docs/002-release-guide.md` describes.
3. Push a new `+mobile-ota` tag.

To stop new downloads at once (pause):

```sh
gh release download ota-index --pattern ota-index.json --clobber
jq --arg r "<runtime>" '.android[$r].paused = true' ota-index.json > next.json
mv next.json ota-index.json
gh release upload ota-index ota-index.json --clobber
```

A pause stops new downloads within about 60 seconds. Devices that already downloaded the
update keep it. Set `paused` to `false` to resume. The next `+mobile-ota` release for that
runtime does not change `paused`.

## Docs changes

- `docs/002-release-guide.md`: add the `+mobile-ota` row to the release type table. Add
  the rollback and pause steps. State that a `+mobile-ota` release fails when the native
  code changed since the last `+mobile` release.
- `GLOSSARY.md`: add the terms from [Terms](#terms).
- `privacy-policy.md`: the summary says "Lunarscribe has no server". Change it to say that
  the mobile app asks the update server for new app code on each launch. The request
  contains the platform and the runtime, plus the IP address that Cloudflare and GitHub
  receive. It contains no writing, account or file data.

## Rollout

1. Phase 0: fix the export and release a `+mobile` tag. This proves the APK still works.
2. Phase 1 and Phase 2: install `expo-updates`, deploy the update server, set the URL,
   commit the certificate and add the secret.
3. Phase 3: change `release.yml`, create the `ota-index` release and release a `+mobile`
   tag. The `register` job adds the first runtime.
4. Install that APK on a test device.
5. Release a `+mobile-ota` tag with a visible JS change. Run the acceptance tests.
6. Update the docs.

Users on 0.13.21 or older must install a new APK one time to get OTA updates.

The pending `react-native-worklets` change from 0.10.1 to 0.10.4 changes native code. Its
first release must be a `+mobile` tag.

## Requirements

1. A `vX.Y.Z` tag runs the desktop jobs and skips the `android`, `ota` and `register`
   jobs.
2. A `vX.Y.Z+mobile` tag runs the desktop jobs and the `android` job, and skips the `ota`
   job.
3. A `vX.Y.Z+mobile-ota` tag runs the desktop jobs and the `ota` job, and skips the
   `android` job.
4. Each of the three tag types publishes the desktop assets.
5. The `ota` job fails when the runtime has no entry in the OTA index.
6. The `ota` job fails when `EXPO_UPDATES_PRIVATE_KEY` does not match
   `apps/mobile/certs/certificate.pem`.
7. The `android` job fails when the runtime before prebuild differs from the runtime after
   the build.
8. The `register` job changes only the entry for the released runtime.
9. A `+mobile` release keeps the `updateTag` and `paused` values of an existing entry.
10. The `ota-index` release is a prerelease and is never the latest release.
11. The update server returns 204 for an unknown runtime.
12. The update server returns 204 for a paused runtime.
13. The update server returns the manifest bytes without change.
14. Every manifest response has the headers `expo-protocol-version: 1`,
    `expo-sfv-version: 0`, `cache-control: private, max-age=0` and `expo-signature`.
15. The mobile app starts without delay when the update server is unreachable.
16. The mobile app shows no UI for update checks, downloads or errors.
17. A change to the app version does not change the runtime.
18. The private key does not appear in the repository, in a release asset or in a job log.

## Acceptance criteria

Do these tests on a physical Android device with the release APK. Use `adb logcat` with
the `expo-updates` tag to see the update events.

1. Push `v<version>` on a test fork. The `android` job shows "skipped". The release has
   the desktop assets and no APK.
2. Push `v<version>+mobile`. The release has the APK. The OTA index has an entry for the
   runtime in `runtime-android.txt`, with `updateTag: null`.
3. Install that APK. Start it two times. The app uses the embedded bundle, and `logcat`
   shows a "no update available" result.
4. Change a visible string in a screen and push `v<next>+mobile-ota`. Start the app, close
   it fully and start it again. The second start shows the new string.
5. Change a visible string in `markdown-dom.tsx` and release a `+mobile-ota` tag. After
   two cold starts, the markdown editor shows the new string.
6. Add a native dependency and push a `+mobile-ota` tag. The `ota` job fails with "No APK
   release has runtime".
7. Edit one byte of `ota-android-manifest.json` on a test release and restart the app. The
   app rejects the update and keeps the running bundle.
8. Replace `ota-android-manifest.json.sig` with a signature from a different key. The app
   rejects the update.
9. Set `paused: true` for the runtime. After 60 seconds, `curl` with that runtime
   returns 204.
10. Release a fix with a revert and a new `+mobile-ota` tag. The device gets the fix after
    two cold starts.
11. Turn on airplane mode and start the app. The file list shows at once, with no error.
12. Change only the version in `app.config.ts`. `runtimeversion:resolve` prints the same
    value.
13. `curl -s https://api.github.com/repos/anargia-pixels/lunarscribe/releases/latest`
    returns a `v*` release, not `ota-index`.
14. `bun run format`, `bun run lint`, `bun run check-types` and `bun run build` pass.

## Risks

| Risk                                                      | Mitigation                                                                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A JS change needs new native code, and the update crashes | The runtime fingerprint changes with native dependencies, and the `ota` job fails. `expo-updates` rolls back to the embedded bundle after a launch crash. |
| GitHub changes the release download URLs                  | The update server and manifest URLs use one `DOWNLOADS` constant. Release a new APK only if the URL format changes.                                       |
| The private key leaks                                     | Generate a new key, release a `+mobile` tag with the new certificate, and remove the old secret. Old APKs keep the old certificate.                       |
| Two mobile tags run at the same time                      | The `register` job uses the `ota-index` concurrency group. The release guide says to push one mobile tag at a time.                                       |
| The Cloudflare free plan limit (100,000 requests per day) | Each cold start sends one request. The current user count is far below the limit. Workers analytics shows the request count.                              |

## Measurement

- Workers analytics: requests per day and the share of 200, 204 and 5xx responses.
- `wrangler tail`: the runtime and result of each request.
- The OTA index: the current `updateTag` for each runtime.

The app sends no analytics. The project does not measure how many devices applied an
update.

## Open questions

None
