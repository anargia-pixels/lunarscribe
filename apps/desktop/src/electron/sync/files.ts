import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";

import { getFileExtension } from "../../lib/editor-files";
import type {
  SyncBaseline,
  SyncConflict,
  SyncedFileChange,
} from "../../lib/sync";
import type { RemoteChange, RemoteFiles } from "./providers/types";

// Sync comparisons
export type LocalSyncFiles = {
  files: Map<string, string>;
  blockedNames: Set<string>;
};

export type SyncPlan = {
  push: RemoteChange[];
  pull: RemoteChange[];
  conflicts: SyncConflict[];
  acknowledged: SyncBaseline;
};

/** Accept supported names directly inside the Lunarscribe documents folder. */
export function isSavedFileName(name: string) {
  return (
    name === basename(name) &&
    !name.includes("\0") &&
    getFileExtension(name) !== null
  );
}

/** Hash saved text so cloud sync can detect changes on each side. */
function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

/** Three-way comparison never tries to merge markdown or drawing JSON. */
export function planSync(
  local: Map<string, string>,
  remote: RemoteFiles,
  baseline: SyncBaseline,
  protectedNames: Set<string>,
  pushName: string | null,
  blockedNames: Set<string>,
): SyncPlan {
  const push: RemoteChange[] = [];
  const pull: RemoteChange[] = [];
  const conflicts: SyncConflict[] = [];
  const acknowledged: SyncBaseline = { ...baseline };

  const names =
    pushName === null
      ? new Set([...local.keys(), ...remote.keys(), ...Object.keys(baseline)])
      : new Set([pushName]);

  for (const name of names) {
    if (blockedNames.has(name) || remote.get(name)?.blocked) {
      conflicts.push({
        name,
        reason:
          "This path is not a regular saved file. Both copies were preserved.",
      });

      continue;
    }

    const localContent = local.get(name) ?? null;
    const remoteContent = remote.get(name)?.content ?? null;
    const localHash = localContent === null ? null : contentHash(localContent);

    const remoteHash =
      remoteContent === null ? null : contentHash(remoteContent);

    const previous = Object.hasOwn(baseline, name) ? baseline[name] : undefined;

    if (localHash === remoteHash) {
      if (localHash === null) {
        delete acknowledged[name];
      } else {
        acknowledged[name] = localHash;
      }

      continue;
    }

    const localChanged =
      previous === undefined ? localHash !== null : localHash !== previous;

    const remoteChanged =
      previous === undefined ? remoteHash !== null : remoteHash !== previous;

    if (localChanged && remoteChanged) {
      conflicts.push({
        name,
        reason:
          previous === undefined
            ? "The local and remote copies differ, and there is no previous sync to compare them with. Keep both or make them match, then retry."
            : "The local and remote copies both changed since the last sync. Compare them before retrying.",
      });

      continue;
    }

    if (remoteChanged && (pushName !== null || protectedNames.has(name))) {
      conflicts.push({
        name,
        reason: protectedNames.has(name)
          ? "An open buffer has pending edits. Save or preserve those edits before pulling the remote copy."
          : "The remote copy changed. Run Sync now before pushing this file.",
      });

      continue;
    }

    const chosen = localChanged ? localContent : remoteContent;
    (localChanged ? push : pull).push({ name, content: chosen });

    if (chosen === null) {
      delete acknowledged[name];
    } else {
      acknowledged[name] = contentHash(chosen);
    }
  }

  return { push, pull, conflicts, acknowledged };
}

// Saved files
/** Read saved files inside the same queue that processes local saves. */
export async function readLocalSyncFiles(
  folder: string,
): Promise<LocalSyncFiles> {
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

/** Recheck each pull inside the save queue after the network work ends. */
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
        throw new Error(
          `The path ${JSON.stringify(change.name)} is not a regular file.`,
        );
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
      plan.conflicts.push({
        name: change.name,
        reason:
          "The local file or its open buffer changed during sync. Both copies were preserved; retry after saving your edits.",
      });

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

/** Return disk changes so clean buffers can reload after a Git merge. */
export function getFileChanges(
  before: Map<string, string>,
  after: Map<string, string>,
) {
  const changes: SyncedFileChange[] = [];

  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const oldContent = before.get(name) ?? null;
    const newContent = after.get(name) ?? null;

    if (oldContent !== newContent)
      changes.push({ name, before: oldContent, after: newContent });
  }

  return changes;
}
