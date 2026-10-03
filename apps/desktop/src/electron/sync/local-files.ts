import {
  lstat,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { getFileExtension } from "../../lib/editor-files";
import type { SyncBaseline, SyncedFileChange } from "../../lib/sync";
import type { SyncPlan } from "./plan";

/** Call within the documents queue so saves and sync observe the same snapshot. */
export async function readLocalSyncFiles(folder: string) {
  const files = new Map<string, string>();
  const blockedNames = new Set<string>();

  for (const name of await readdir(folder)) {
    if (!getFileExtension(name)) {
      continue;
    }

    const path = join(folder, name);

    if ((await lstat(path)).isFile()) {
      files.set(name, await readFile(path, "utf8"));
    } else {
      blockedNames.add(name);
    }
  }

  return { files, blockedNames };
}

/** Recheck each pull inside the documents queue after the network work finishes. */
export async function applySyncPulls(
  folder: string,
  snapshot: Map<string, string>,
  plan: SyncPlan,
  baseline: SyncBaseline,
  getProtectedNames: () => Set<string>,
  onApplied: (change: SyncedFileChange) => void,
) {
  const changes: SyncedFileChange[] = [];

  for (const change of plan.pull) {
    const path = join(folder, change.name);
    const before = snapshot.get(change.name) ?? null;
    let current: string | null = null;

    try {
      if (!(await lstat(path)).isFile()) {
        throw new Error(`The path ${change.name} is not a regular file.`);
      }

      current = await readFile(path, "utf8");
    } catch (cause) {
      if (
        !(cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      ) {
        throw cause;
      }
    }

    if (getProtectedNames().has(change.name) || before !== current) {
      plan.conflicts.push(change.name);

      if (Object.hasOwn(baseline, change.name)) {
        plan.acknowledged[change.name] = baseline[change.name]!;
      } else {
        delete plan.acknowledged[change.name];
      }

      continue;
    }

    if (change.content === null) {
      await rm(path, { force: true });
    } else {
      const temporaryPath = join(folder, `.sync-${crypto.randomUUID()}`);

      try {
        await writeFile(temporaryPath, change.content, {
          flag: "wx",
          mode: 0o600,
        });
        await rename(temporaryPath, path);
      } finally {
        await rm(temporaryPath, { force: true });
      }
    }

    const applied = { name: change.name, before, after: change.content };
    changes.push(applied);
    // Refresh buffers even if a later pull or settings write fails.
    onApplied(applied);
  }

  return changes;
}
