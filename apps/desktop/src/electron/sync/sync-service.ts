import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

import { errorMessage } from "@lunarscribe/utils/error-message";
import type { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import type { FileSyncProvider } from "@lunarscribe/utils/sync/types";
import { SyncSignInRequired } from "@lunarscribe/utils/sync/types";
import { app, BrowserWindow, ipcMain } from "electron";

import type { SyncProvider, SyncResult, SyncStatus } from "../../lib/sync";
import { SYNC_PROVIDERS } from "../../lib/sync";
import { refreshTokens, signIn } from "./auth/oauth";
import type { OAuthProvider } from "./auth/oauth";
import {
  applySyncPulls,
  contentHash,
  isSavedFileName,
  planSync,
  readLocalSyncFiles,
} from "./files";
import { createDropboxApi } from "./providers/dropbox";
import {
  connectGithub,
  disconnectGithub,
  forceWriteGithub,
  syncGithub,
} from "./providers/github";
import { createGoogleDriveApi } from "./providers/google-drive";
import publicCredentials from "./public-creds.json";
import { createEmptySettings, createSyncSettings } from "./settings";

// Background schedule
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Send public sync state and file changes to every open window. */
function broadcast<T>(channel: string, payload: T) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

/** Register sync IPC and scheduling with the documents save queue. */
export function registerSync(
  folder: string,
  queue: ReturnType<typeof createOperationQueue>,
) {
  // Load saved state before accepting IPC operations.
  const directory = join(app.getPath("userData"), "sync");
  const persistence = createSyncSettings(directory);
  let settings = createEmptySettings();
  let isBusy = false;
  let error: string | null = null;
  let authorization: AbortController | null = null;
  let needsSignIn = false;
  const protectedByWindow = new Map<number, Set<string>>();

  const loaded = persistence
    .load()
    .then((saved) => {
      settings = saved;
      needsSignIn =
        saved.provider !== null &&
        saved.provider !== "github" &&
        saved.tokens === null;

      if (needsSignIn) {
        error =
          "Sign-in is required. Open Settings → Syncing and select Sign in again.";
      }
    })
    .catch((cause) => {
      error = errorMessage(cause, "Unable to load sync settings.");
    });

  const getStatus = (): SyncStatus => ({
    provider: settings.provider,
    account: settings.account,
    busy: isBusy,
    lastSyncedAt: settings.lastSyncedAt,
    error,
    needsSignIn,
  });

  const broadcastStatus = () => broadcast("sync:status", getStatus());

  // Access tokens stay in the main process.
  /** Refresh expired tokens, or require sign-in when refresh is absent. */
  async function getAccessToken(provider: OAuthProvider) {
    if (!settings.tokens || settings.provider !== provider) {
      throw new SyncSignInRequired("Reconnect your sync account.");
    }

    let tokens = settings.tokens;

    if (tokens.expiresAt <= Date.now() + 60_000) {
      if (!tokens.refreshToken) {
        throw new SyncSignInRequired(
          "Google Drive needs browser sign-in again. Open Settings → Syncing and select Sign in again. Your writing is safe.",
        );
      }

      tokens = await refreshTokens(provider, tokens);
      settings.tokens = tokens;
      await persistence.save(settings);
    }

    return tokens.accessToken;
  }

  /** Build a cloud adapter with the current token and saved destination. */
  function createCloudProvider(): FileSyncProvider {
    if (settings.provider === "google-drive" && settings.folderId) {
      return createGoogleDriveApi(() =>
        getAccessToken("google-drive"),
      ).createProvider(settings.folderId);
    }

    if (settings.provider === "dropbox") {
      return createDropboxApi(() => getAccessToken("dropbox")).createProvider();
    }

    throw new Error("Connect a sync provider first.");
  }

  // Sync operations
  /** Allow one sync operation and broadcast its status to all windows. */
  async function runSyncOperation<T>(operation: () => Promise<T>) {
    await loaded;

    if (isBusy) {
      throw new Error(
        "A sync operation is already running. Try again when it finishes.",
      );
    }

    isBusy = true;
    error = null;
    broadcastStatus();

    try {
      return await operation();
    } catch (cause) {
      if (cause instanceof SyncSignInRequired) {
        needsSignIn = true;
      }

      error = errorMessage(cause, "Sync failed. Your local writing is safe.");
      throw new Error(error);
    } finally {
      isBusy = false;
      broadcastStatus();
    }
  }

  /** Protect pending buffer edits across all open windows. */
  function getProtectedNames() {
    return new Set(
      [...protectedByWindow.values()].flatMap((names) => [...names]),
    );
  }

  /** Compare with the shared base and reject concurrent remote writes. */
  async function syncCloud(name: string | null): Promise<SyncResult> {
    const remoteProvider = createCloudProvider();
    const remote = await remoteProvider.read(name);
    const local = await queue(folder, () => readLocalSyncFiles(folder));

    const plan = planSync(
      local,
      remote,
      settings.baseline,
      getProtectedNames(),
      name,
    );

    await remoteProvider.write(plan.push, remote);

    return queue(folder, async () => {
      const changes = await applySyncPulls(
        folder,
        local,
        plan,
        settings.baseline,
        getProtectedNames,
        (change) => broadcast("sync:files", [change]),
      );

      settings.baseline = plan.acknowledged;

      return {
        conflicts: plan.conflicts,
        pushed: plan.push.length,
        pulled: changes.length,
      };
    });
  }

  /** Keep Git merges and cloud comparisons behind the same status events. */
  async function sync(name: string | null): Promise<SyncResult> {
    return runSyncOperation(async () => {
      if (name !== null && !isSavedFileName(name)) {
        throw new Error("Only saved markdown and drawings can be synced.");
      }

      const syncResult =
        settings.provider === "github" && settings.account
          ? await syncGithub(
              folder,
              settings.account,
              name,
              queue,
              getProtectedNames,
              (changes) => broadcast("sync:files", changes),
            )
          : await syncCloud(name);

      settings.lastSyncedAt = new Date().toISOString();
      await persistence.save(settings);
      broadcast("sync:result", syncResult);

      return syncResult;
    });
  }

  // Renderer requests
  ipcMain.handle("sync:status", async () => {
    await loaded;

    return getStatus();
  });
  ipcMain.handle("sync:run", (_event, name: string | null) => sync(name));
  ipcMain.handle("sync:force", (_event, name: string) =>
    runSyncOperation(async (): Promise<SyncResult> => {
      if (!isSavedFileName(name)) {
        throw new Error("Only saved markdown and drawings can be synced.");
      }

      const local = await queue(folder, async () => {
        const path = join(folder, name);
        const metadata = await lstat(path);

        if (!metadata.isFile()) {
          throw new Error("The selected path is not a regular saved file.");
        }

        return {
          content: await readFile(path, "utf8"),
          modifiedAt: metadata.mtimeMs,
        };
      });

      if (settings.provider === "github" && settings.account) {
        await forceWriteGithub(
          folder,
          settings.account,
          name,
          local.content,
          queue,
        );
      } else {
        await createCloudProvider().forceWrite(
          name,
          local.content,
          local.modifiedAt,
        );
        Object.defineProperty(settings.baseline, name, {
          value: contentHash(local.content),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }

      const result = { conflicts: [], pushed: 1, pulled: 0 };
      settings.lastSyncedAt = new Date().toISOString();
      await persistence.save(settings);
      broadcast("sync:result", result);

      return result;
    }),
  );
  ipcMain.handle("sync:connect", async (_event, selected: SyncProvider) => {
    await runSyncOperation(async () => {
      if (!Object.hasOwn(SYNC_PROVIDERS, selected)) {
        throw new Error("Unknown sync provider.");
      }

      const next = createEmptySettings();
      next.provider = selected;

      if (selected === "github") {
        next.account = await connectGithub(folder, queue);
      } else {
        authorization = new AbortController();

        try {
          const tokens = await signIn(
            selected,
            selected === "google-drive"
              ? publicCredentials.googleClientId
              : publicCredentials.dropboxAppKey,
            authorization.signal,
          );

          next.tokens = tokens;

          if (selected === "google-drive") {
            const api = createGoogleDriveApi(async () => tokens.accessToken);
            next.folderId = await api.getOrCreateFolder();
            next.account = await api.getAccountEmail();
          } else {
            next.account = await createDropboxApi(
              async () => tokens.accessToken,
            ).connect();
          }

          authorization.signal.throwIfAborted();
        } finally {
          authorization = null;
        }
      }

      // Keep comparison history when the same destination reconnects.
      if (
        settings.provider === next.provider &&
        settings.account === next.account &&
        settings.folderId === next.folderId
      ) {
        next.baseline = settings.baseline;
        next.lastSyncedAt = settings.lastSyncedAt;
      }

      await persistence.save(next);
      settings = next;
      needsSignIn = false;
    });

    return getStatus();
  });
  ipcMain.handle("sync:disconnect", async () => {
    await runSyncOperation(async () => {
      if (settings.provider === "github") {
        await queue(folder, () => disconnectGithub(folder));
      }

      const next = createEmptySettings();
      await persistence.save(next);
      settings = next;
      needsSignIn = false;
    });

    return getStatus();
  });
  ipcMain.on("sync:cancel", () => authorization?.abort());
  ipcMain.on("sync:protected", (event, names: string[]) => {
    if (!protectedByWindow.has(event.sender.id)) {
      event.sender.once("destroyed", () =>
        protectedByWindow.delete(event.sender.id),
      );
    }

    protectedByWindow.set(event.sender.id, new Set(names));
  });

  // Run background sync only while an app window is open.
  function syncInBackground() {
    void loaded
      .then(async () => {
        if (
          settings.provider &&
          !needsSignIn &&
          !isBusy &&
          BrowserWindow.getAllWindows().length > 0
        ) {
          await sync(null);
        }
      })
      .catch(() => undefined);
  }

  // The first window asks for this sync after it listens for downloaded files.
  ipcMain.once("sync:startup", syncInBackground);
  const timer = setInterval(syncInBackground, SYNC_INTERVAL_MS);

  app.once("before-quit", () => {
    clearInterval(timer);
    authorization?.abort();
  });
}
