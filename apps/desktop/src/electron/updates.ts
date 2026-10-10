import { execFile } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { jsonString, parseJson } from "@lunarscribe/utils/sync/json";
import { app, ipcMain, net } from "electron";

import type { AppInfo, UpdateCheck } from "../lib/updates";

const execFileAsync = promisify(execFile);

const LATEST_RELEASE_URL =
  "https://api.github.com/repos/anargia-pixels/lunarscribe/releases/latest";

/** Shown when install.sh cannot replace this copy in place. */
const CANNOT_UPDATE = "This copy of Lunarscribe cannot update itself.";

/** Release tags read `v1.2.3`, with optional build metadata such as `+mobile`. */
const RELEASE_TAG = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/;

/** Version numbers of a release tag, or `null` when the tag is not a version. */
function parseVersion(tag: string) {
  const match = RELEASE_TAG.exec(tag);

  return match ? match.slice(1, 4).map(Number) : null;
}

function isNewerVersion(latest: number[], current: number[]) {
  for (const [position, part] of latest.entries()) {
    const currentPart = current[position] ?? 0;

    if (part !== currentPart) {
      return part > currentPart;
    }
  }

  return false;
}

/** The app folder on Linux, and the app bundle on macOS. */
function getApplicationFolder() {
  // The executable sits at Lunarscribe.app/Contents/MacOS/Lunarscribe on macOS.
  return process.platform === "darwin"
    ? resolve(process.execPath, "../../..")
    : dirname(process.execPath);
}

/**
 * The folder install.sh installs into: the app folder on Linux, and the folder holding
 * `Lunarscribe.app` on macOS. `null` when install.sh cannot replace this copy in place.
 */
function getInstallDirectory() {
  if (process.platform === "linux" && process.arch === "x64") {
    return getApplicationFolder();
  }

  if (process.platform === "darwin" && process.arch === "arm64") {
    const bundle = getApplicationFolder();

    return basename(bundle) === "Lunarscribe.app" ? dirname(bundle) : null;
  }

  return null;
}

/** The newest release tag without build metadata, or `null` when this copy is current. */
async function findUpdate(): Promise<UpdateCheck> {
  if (!app.isPackaged) {
    return { version: null, error: "Development builds do not update." };
  }

  if (getInstallDirectory() === null) {
    return { version: null, error: CANNOT_UPDATE };
  }

  const response = await net.fetch(LATEST_RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status}.`);
  }

  const tag = jsonString(parseJson(await response.text()), "tag_name");
  const latest = parseVersion(tag);
  const current = parseVersion(app.getVersion());

  if (!latest || !current || !isNewerVersion(latest, current)) {
    return { version: null, error: null };
  }

  return { version: `v${latest.join(".")}`, error: null };
}

/** Versions and folders for the About pane. */
function getAppInfo(): AppInfo {
  const system = process.platform === "darwin" ? "macOS" : "Linux";

  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
    operatingSystem: `${system} ${process.getSystemVersion()}`,
    architecture: process.arch,
    applicationFolder: getApplicationFolder(),
    userDataFolder: app.getPath("userData"),
  };
}

/** Runs the bundled installer over this copy, which downloads and verifies the latest release. */
async function installUpdate(installDirectory: string) {
  // Finder starts apps with a minimal PATH that misses Homebrew's jq.
  const path =
    process.platform === "darwin"
      ? `${process.env["PATH"]}:/opt/homebrew/bin:/usr/local/bin`
      : process.env["PATH"];

  try {
    await execFileAsync("bash", [join(process.resourcesPath, "install.sh")], {
      // curl's progress bar alone can pass the 1 MiB default.
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: path,
        LUNARSCRIBE_VERSION: "latest",
        LUNARSCRIBE_INSTALL_DIR: installDirectory,
      },
    });

    return { error: null };
  } catch (cause) {
    // install.sh reports its failure on the last `error:` line of stderr.
    const stderr =
      cause instanceof Error && "stderr" in cause ? String(cause.stderr) : "";

    const reason = stderr
      .split("\n")
      .findLast((line) => line.startsWith("error: "))
      ?.slice("error: ".length);

    return { error: reason ?? "The installer stopped unexpectedly." };
  }
}

/** Answers update checks and installs from the renderer, which runs one of each at a time. */
export function registerUpdates() {
  ipcMain.handle("app:info", getAppInfo);

  ipcMain.handle("updates:check", () =>
    findUpdate().catch((cause) => {
      console.error("Unable to check for updates.", cause);

      return { version: null, error: "GitHub could not be reached." };
    }),
  );

  ipcMain.handle("updates:install", () => {
    const installDirectory = getInstallDirectory();

    return installDirectory === null
      ? { error: CANNOT_UPDATE }
      : installUpdate(installDirectory);
  });

  ipcMain.on("updates:restart", () => {
    app.relaunch();
    app.quit();
  });
}
