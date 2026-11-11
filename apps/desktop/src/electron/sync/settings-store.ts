import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createEmptySettings,
  parseSyncSettings,
} from "@lunarscribe/utils/sync/settings";
import type { SyncSettingsStore } from "@lunarscribe/utils/sync/settings";

import { isSyncProvider } from "../../lib/sync";
import type { SyncProvider } from "../../lib/sync";

/** Settings in `sync-settings.json`, replaced atomically with owner-only access. */
export function createSettingsStore(
  directory: string,
): SyncSettingsStore<SyncProvider> {
  const path = join(directory, "sync-settings.json");

  return {
    async load() {
      try {
        return parseSyncSettings(await readFile(path, "utf8"), isSyncProvider);
      } catch (cause) {
        if (
          cause instanceof Error &&
          "code" in cause &&
          cause.code === "ENOENT"
        ) {
          return createEmptySettings();
        }

        throw cause;
      }
    },
    async save(settings) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = `${path}.${crypto.randomUUID()}.tmp`;

      try {
        await writeFile(temporary, JSON.stringify(settings, null, 2), {
          mode: 0o600,
          flag: "wx",
        });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
