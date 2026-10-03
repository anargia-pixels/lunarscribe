import { join } from "node:path";

import { errorMessage } from "@lunarscribe/utils/error-message";
import { app, BrowserWindow, ipcMain } from "electron";

import type { createOperationQueue } from "../../lib/operation-queue";
import type { SyncProvider, SyncResult, SyncStatus } from "../../lib/sync";
import { SYNC_PROVIDERS } from "../../lib/sync";
import { refreshTokens, signIn } from "./auth/oauth";
import type { OAuthProvider } from "./auth/oauth";
import {
  applySyncPulls,
  isSavedFileName,
  planSync,
  readLocalSyncFiles,
} from "./files";
import { createDropboxApi } from "./providers/dropbox";
import {
  connectGithub,
  disconnectGithub,
  syncGithub,
} from "./providers/github";
import { createGoogleDriveApi } from "./providers/google-drive";
import type { FileSyncProvider } from "./providers/types";
import { SyncSignInRequired } from "./providers/types";
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

  /** Cloud providers compare file hashes and reject stale remote revisions. */
  async function syncCloud(name: string | null): Promise<SyncResult> {
    const remoteProvider = createCloudProvider();
    const remote = await remoteProvider.read();
    const local = await queue(folder, () => readLocalSyncFiles(folder));

    const plan = planSync(
      local.files,
      remote,
      settings.baseline,
      getProtectedNames(),
      name,
      local.blockedNames,
    );

    await remoteProvider.write(plan.push, remote);

    return queue(folder, async () => {
      const changes = await applySyncPulls(
        folder,
        local.files,
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
  const timer = setInterval(() => {
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
  }, SYNC_INTERVAL_MS);

  app.once("before-quit", () => {
    clearInterval(timer);
    authorization?.abort();
  });
}
