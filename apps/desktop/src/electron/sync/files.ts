import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  rename,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";

import type { RemoteChange, RemoteFiles } from "@lunarscribe/utils/sync/types";

import { getFileExtension } from "../../lib/editor-files";
import type {
  SyncBaseline,
  SyncConflict,
  SyncedFileChange,
} from "../../lib/sync";

// Sync comparisons
export type LocalSyncFiles = {
  files: Map<string, string>;
  modifiedTimes: Map<string, number>;
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
export function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

/** Compare with the shared base; never pull an older remote file over local edits. */
export function planSync(
  local: LocalSyncFiles,
  remote: RemoteFiles,
  baseline: SyncBaseline,
  protectedNames: Set<string>,
  pushName: string | null,
): SyncPlan {
  const push: RemoteChange[] = [];
  const pull: RemoteChange[] = [];
  const conflicts: SyncConflict[] = [];
  const acknowledged: SyncBaseline = { ...baseline };

  const names =
    pushName === null
      ? new Set([
          ...local.files.keys(),
          ...remote.keys(),
          ...Object.keys(baseline),
        ])
      : new Set([pushName]);

  for (const name of names) {
    if (local.blockedNames.has(name) || remote.get(name)?.blocked) {
      conflicts.push({
        name,
        reason:
          "This path is not a regular saved file. Both copies were preserved.",
      });

      continue;
    }

    const localContent = local.files.get(name) ?? null;
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

    const localModifiedAt = local.modifiedTimes.get(name);
    const remoteModifiedAt = remote.get(name)?.modifiedAt;
    const precisionMs = remote.get(name)?.modifiedAtPrecisionMs ?? 1;

    const localTime =
      localModifiedAt === undefined
        ? null
        : Math.floor(localModifiedAt / precisionMs);

    const remoteTime =
      remoteModifiedAt === undefined
        ? null
        : Math.floor(remoteModifiedAt / precisionMs);

    const isLocalNewer =
      localTime !== null && remoteTime !== null && localTime > remoteTime;

    let isPush = localChanged || isLocalNewer;

    if (
      previous === undefined &&
      localContent !== null &&
      remoteContent !== null
    ) {
      if (localTime === remoteTime) {
        conflicts.push({
          name,
          reason:
            "The copies differ but have the same modification time. Compare them or use Force changes to remote to keep the local copy.",
        });

        continue;
      }

      isPush = isLocalNewer;
    } else if (localChanged && remoteChanged) {
      conflicts.push({
        name,
        reason:
          "The local and remote copies both changed since the last sync. Compare them, or select Force changes to remote to keep the local copy.",
      });

      continue;
    }

    if (!isPush && (pushName !== null || protectedNames.has(name))) {
      conflicts.push({
        name,
        reason: protectedNames.has(name)
          ? "An open buffer has pending edits. Save or preserve those edits before pulling the remote copy."
          : "The remote copy changed. Run Sync now before pushing this file.",
      });

      continue;
    }

    const chosen = isPush ? localContent : remoteContent;
    const modifiedAt = isPush ? localModifiedAt : remoteModifiedAt;
    const chosenHash = isPush ? localHash : remoteHash;
    const changes = isPush ? push : pull;

    changes.push(
      chosen === null
        ? { name, content: null }
        : {
            name,
            content: chosen,
            modifiedAt: modifiedAt!,
          },
    );

    if (chosen === null) {
      delete acknowledged[name];
    } else {
      acknowledged[name] = chosenHash!;
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
  const modifiedTimes = new Map<string, number>();
  const blockedNames = new Set<string>();

  for (const name of await readdir(folder)) {
    if (!getFileExtension(name)) {
      continue;
    }

    const path = join(folder, name);

    const metadata = await lstat(path);

    if (metadata.isFile()) {
      files.set(name, await readFile(path, "utf8"));
      modifiedTimes.set(name, metadata.mtimeMs);
    } else {
      blockedNames.add(name);
    }
  }

  return { files, modifiedTimes, blockedNames };
}

/** Recheck each pull inside the save queue after the network work ends. */
export async function applySyncPulls(
  folder: string,
  snapshot: LocalSyncFiles,
  plan: SyncPlan,
  baseline: SyncBaseline,
  getProtectedNames: () => Set<string>,
  onApplied: (change: SyncedFileChange) => void,
) {
  const changes: SyncedFileChange[] = [];

  for (const change of plan.pull) {
    const path = join(folder, change.name);
    const before = snapshot.files.get(change.name) ?? null;
    let current: string | null = null;
    let currentModifiedAt: number | undefined;

    try {
      const metadata = await lstat(path);

      if (!metadata.isFile()) {
        throw new Error(
          `The path ${JSON.stringify(change.name)} is not a regular file.`,
        );
      }

      current = await readFile(path, "utf8");
      currentModifiedAt = metadata.mtimeMs;
    } catch (cause) {
      if (
        !(cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      ) {
        throw cause;
      }
    }

    if (
      getProtectedNames().has(change.name) ||
      before !== current ||
      snapshot.modifiedTimes.get(change.name) !== currentModifiedAt
    ) {
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
        const modifiedAt = new Date(change.modifiedAt);
        await utimes(temporaryPath, modifiedAt, modifiedAt);
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
