import { join } from "node:path";

import type { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import { revokeTokens } from "@lunarscribe/utils/sync/oauth";
import type {
  LocalSyncFile,
  LocalSyncStore,
} from "@lunarscribe/utils/sync/plan";
import {
  createCloudBackend,
  createSyncService,
} from "@lunarscribe/utils/sync/service";
import type { SyncBackend } from "@lunarscribe/utils/sync/service";
import type { CloudSyncProvider } from "@lunarscribe/utils/sync/types";
import { app, BrowserWindow, ipcMain } from "electron";
import type { WebContents } from "electron";

import type { SyncProvider } from "../../lib/sync";
import { refreshTokens, signIn } from "./auth/oauth";
import { createLocalSyncStore, readSavedText, writeSavedFile } from "./files";
import {
  connectGithub,
  disconnectGithub,
  forceWriteGithub,
  readGithubFile,
  syncGithub,
} from "./providers/github";
import publicCredentials from "./public-creds.json";
import { createSettingsStore } from "./settings-store";

// Background schedule
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Send public sync state and file changes to every open window, or all but `except`. */
function broadcast<T>(channel: string, payload: T, except?: WebContents) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.webContents !== except) {
      window.webContents.send(channel, payload);
    }
  }
}

/** Sync through the Git repository `lunarscribe` in the account's GitHub. */
function createGithubBackend(
  folder: string,
  queue: ReturnType<typeof createOperationQueue>,
  local: LocalSyncStore,
): SyncBackend<SyncProvider> {
  /** The connected account; GitHub keeps no tokens of its own here. */
  function accountOf(account: string | null) {
    if (!account) {
      throw new Error("Connect a sync provider first.");
    }

    return account;
  }

  return {
    isSignedIn: () => true,
    connect: async () => ({
      account: await connectGithub(folder, queue),
      folderId: null,
      tokens: null,
    }),
    disconnect: () => queue(folder, () => disconnectGithub(folder)),
    sync: (session, name) =>
      syncGithub(
        folder,
        accountOf(session.settings.account),
        name,
        queue,
        session.getProtectedNames,
        session.emitFiles,
      ),
    async forcePush(session, name) {
      const file = (await local.read(name)).get(name);

      if (!file || file.blocked || file.content instanceof Uint8Array) {
        throw new Error("The selected path is not a regular saved file.");
      }

      await forceWriteGithub(
        folder,
        accountOf(session.settings.account),
        name,
        file.content,
        queue,
      );
    },
    async forcePull(session, name) {
      const after = await readGithubFile(
        folder,
        accountOf(session.settings.account),
        name,
        queue,
      );

      return queue(folder, async () => {
        const before = await readSavedText(folder, name);

        await writeSavedFile(
          folder,
          after === null
            ? { name, content: null }
            : { name, content: after, modifiedAt: Date.now() },
        );

        return { name, before, after };
      });
    },
  };
}

/** Register sync IPC and scheduling with the documents save queue. */
export function registerSync(
  folder: string,
  queue: ReturnType<typeof createOperationQueue>,
) {
  const protectedByWindow = new Map<number, Set<string>>();
  const local = createLocalSyncStore(folder, queue);

  const cloudBackend = (provider: CloudSyncProvider) =>
    createCloudBackend<LocalSyncFile, SyncProvider>(
      provider,
      {
        signIn: (signal) =>
          signIn(
            provider,
            provider === "google-drive"
              ? publicCredentials.googleClientId
              : publicCredentials.dropboxAppKey,
            signal,
          ),
        refresh: (tokens) => refreshTokens(provider, tokens),
        revoke: (tokens) => revokeTokens(provider, tokens),
      },
      local,
    );

  const service = createSyncService<SyncProvider>({
    backends: {
      github: createGithubBackend(folder, queue, local),
      "google-drive": cloudBackend("google-drive"),
      dropbox: cloudBackend("dropbox"),
    },
    settings: createSettingsStore(join(app.getPath("userData"), "sync")),
    // Protect pending buffer edits across all open windows.
    getProtectedNames: () =>
      new Set([...protectedByWindow.values()].flatMap((names) => [...names])),
  });

  service.onStatus((status) => broadcast("sync:status", status));
  service.onResult((result) => broadcast("sync:result", result));
  service.onFiles((changes) => broadcast("sync:files", changes));

  // Renderer requests
  ipcMain.handle("sync:status", async () => {
    await service.ready;

    return service.getStatus();
  });
  ipcMain.handle("sync:run", (_event, name: string | null) =>
    service.sync(name),
  );
  ipcMain.handle("sync:force", (_event, name: string) =>
    service.forcePush(name),
  );
  // The requesting window applies the change itself, discarding pending edits.
  ipcMain.handle("sync:force-pull", async (event, name: string) => {
    const change = await service.forcePull(name);
    broadcast("sync:files", [change], event.sender);

    return change;
  });
  ipcMain.handle("sync:connect", (_event, provider: SyncProvider) =>
    service.connect(provider),
  );
  ipcMain.handle("sync:disconnect", () => service.disconnect());
  ipcMain.on("sync:cancel", service.cancelSignIn);
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
    if (BrowserWindow.getAllWindows().length > 0) {
      void service.syncInBackground();
    }
  }

  // The first window asks for this sync after it listens for downloaded files.
  ipcMain.once("sync:startup", syncInBackground);
  const timer = setInterval(syncInBackground, SYNC_INTERVAL_MS);

  app.once("before-quit", () => {
    clearInterval(timer);
    service.cancelSignIn();
  });
}
