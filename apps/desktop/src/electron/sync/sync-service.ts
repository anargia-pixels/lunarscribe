import { basename, join } from "node:path";

import { errorMessage } from "@lunarscribe/utils/error-message";
import { app, BrowserWindow, ipcMain } from "electron";

import { getFileExtension } from "../../lib/editor-files";
import type { createOperationQueue } from "../../lib/operation-queue";
import type { SyncProvider, SyncResult, SyncStatus } from "../../lib/sync";
import { SYNC_PROVIDERS } from "../../lib/sync";
import { DROPBOX_CLIENT_ID, GOOGLE_CLIENT_ID } from "./client-ids";
import { createDropboxApi } from "./dropbox";
import { connectGithub, createGithubProvider } from "./github";
import { createGoogleDriveApi } from "./google-drive";
import { applySyncPulls, readLocalSyncFiles } from "./local-files";
import { refreshTokens, signIn } from "./oauth";
import type { OAuthProvider } from "./oauth";
import { planSync } from "./plan";
import type { FileSyncProvider } from "./provider";
import { SyncSignInRequired } from "./provider";
import {
  decryptTokens,
  createEmptySettings,
  encryptTokens,
  requireTokenEncryption,
  createSyncSettings,
} from "./settings";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

function broadcast<T>(channel: string, data: T) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data);
  }
}

/** One queue coordinates synchronization, local saves, renames, and deletions. */
export function registerSync(
  folder: string,
  queue: ReturnType<typeof createOperationQueue>,
) {
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
    googleConfigured: Boolean(GOOGLE_CLIENT_ID),
    dropboxConfigured: Boolean(DROPBOX_CLIENT_ID),
    needsSignIn,
  });

  const notify = () => broadcast("sync:status", getStatus());

  function getClientId(selected: OAuthProvider, publicClientId: string) {
    const enteredClientId = publicClientId.trim();

    if (enteredClientId) {
      return enteredClientId;
    }

    if (settings.provider === selected && settings.tokens) {
      return decryptTokens(settings.tokens).clientId;
    }

    return selected === "google-drive" ? GOOGLE_CLIENT_ID : DROPBOX_CLIENT_ID;
  }

  async function getAccessToken(provider: OAuthProvider) {
    if (!settings.tokens || settings.provider !== provider) {
      throw new Error("Reconnect your sync account.");
    }

    let tokens = decryptTokens(settings.tokens);

    if (tokens.expiresAt <= Date.now() + 60_000) {
      if (!tokens.refreshToken) {
        needsSignIn = true;
        throw new Error(
          "Google Drive needs browser sign-in again. Open Settings → Syncing and select Sign in again. Your writing is safe.",
        );
      }

      tokens = await refreshTokens(provider, tokens);
      settings.tokens = encryptTokens(tokens);
      await persistence.save(settings);
    }

    return tokens.accessToken;
  }

  function createProvider(): FileSyncProvider {
    if (settings.provider === "github" && settings.account) {
      return createGithubProvider(directory, settings.account);
    }

    if (settings.provider === "google-drive" && settings.folderId) {
      return createGoogleDriveApi(() =>
        getAccessToken("google-drive"),
      ).provider(settings.folderId);
    }

    if (settings.provider === "dropbox") {
      return createDropboxApi(() => getAccessToken("dropbox")).provider();
    }

    throw new Error("Connect a sync provider first.");
  }

  async function run<T>(operation: () => Promise<T>) {
    await loaded;

    if (isBusy) {
      throw new Error(
        "A sync operation is already running. Try again when it finishes.",
      );
    }

    isBusy = true;
    error = null;
    notify();

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
      notify();
    }
  }

  function getProtectedNames() {
    return new Set(
      [...protectedByWindow.values()].flatMap((names) => [...names]),
    );
  }

  async function sync(name: string | null): Promise<SyncResult> {
    return run(async () => {
      if (
        name !== null &&
        (name !== basename(name) || !getFileExtension(name))
      ) {
        throw new Error("Only saved markdown and drawings can be synced.");
      }

      const remoteProvider = createProvider();
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
        settings.lastSyncedAt = new Date().toISOString();
        await persistence.save(settings);

        const syncResult = {
          conflicts: plan.conflicts,
          pushed: plan.push.length,
          pulled: changes.length,
        };

        broadcast("sync:result", syncResult);

        return syncResult;
      });
    });
  }

  ipcMain.handle("sync:status", async () => {
    await loaded;

    return getStatus();
  });
  ipcMain.handle("sync:run", (_event, name: string | null) => sync(name));
  ipcMain.handle(
    "sync:connect",
    async (_event, selected: SyncProvider, publicClientId: string) => {
      await run(async () => {
        if (!Object.hasOwn(SYNC_PROVIDERS, selected)) {
          throw new Error("Unknown sync provider.");
        }

        const next = createEmptySettings();
        next.provider = selected;

        if (selected === "github") {
          next.account = await connectGithub(directory);
        } else {
          requireTokenEncryption();
          authorization = new AbortController();

          try {
            const tokens = await signIn(
              selected,
              getClientId(selected, publicClientId),
              authorization.signal,
            );

            next.tokens = encryptTokens(tokens);

            if (selected === "google-drive") {
              const api = createGoogleDriveApi(async () => tokens.accessToken);
              next.folderId = await api.folder();
              next.account = await api.account();
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

        // Reconnecting the same destination keeps deletion history and conflict comparisons.
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
    },
  );
  ipcMain.handle("sync:disconnect", async () => {
    await run(async () => {
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
