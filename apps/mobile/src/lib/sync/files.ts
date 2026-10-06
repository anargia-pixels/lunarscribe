import type { RemoteChange, RemoteFiles } from "@lunarscribe/utils/sync/types";
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
} from "expo-crypto";

import { applySyncedFile, readAllFiles } from "@/lib/documents-folder";
import type { SavedFileRecord } from "@/lib/documents-folder";
import { getFileExtension } from "@/lib/editor-files";
import type { PulledFileTimes } from "@/lib/sync/settings";
import type {
  SyncBaseline,
  SyncConflict,
  SyncedFileChange,
} from "@/lib/sync/sync-types";

// Sync comparisons
/** A saved file with the modification time sync compares, as read when the sync started. */
export type LocalSyncFile = SavedFileRecord & { modifiedAt: number };

export type LocalSyncFiles = Map<string, LocalSyncFile>;

export type SyncPlan = {
  push: RemoteChange[];
  pull: RemoteChange[];
  conflicts: SyncConflict[];
  acknowledged: SyncBaseline;
};

/** Accept supported flat names, the same names saved files use. */
export function isSavedFileName(name: string) {
  return (
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("\0") &&
    getFileExtension(name) !== null
  );
}

/** Hash saved text so cloud sync can detect changes on each side. */
export function contentHash(content: string) {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, content, {
    encoding: CryptoEncoding.HEX,
  });
}

/** Compare with the shared base; never pull an older remote file over local edits. */
export async function planSync(
  local: LocalSyncFiles,
  remote: RemoteFiles,
  baseline: SyncBaseline,
  protectedNames: Set<string>,
  pushName: string | null,
): Promise<SyncPlan> {
  const push: RemoteChange[] = [];
  const pull: RemoteChange[] = [];
  const conflicts: SyncConflict[] = [];
  const acknowledged: SyncBaseline = { ...baseline };

  const names =
    pushName === null
      ? new Set([...local.keys(), ...remote.keys(), ...Object.keys(baseline)])
      : new Set([pushName]);

  for (const name of names) {
    if (remote.get(name)?.blocked) {
      conflicts.push({
        name,
        reason:
          "The remote path is not a regular file. Both copies were preserved.",
      });

      continue;
    }

    const localContent = local.get(name)?.content ?? null;
    const remoteContent = remote.get(name)?.content ?? null;

    const localHash =
      localContent === null ? null : await contentHash(localContent);

    const remoteHash =
      remoteContent === null ? null : await contentHash(remoteContent);

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

    const localModifiedAt = local.get(name)?.modifiedAt;
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
/**
 * Read saved files inside the same queue that processes local saves. A file still
 * as sync wrote it reports the remote copy's modification time.
 */
export async function readLocalSyncFiles(
  pulledTimes: PulledFileTimes,
): Promise<LocalSyncFiles> {
  return new Map(
    (await readAllFiles()).map((record) => {
      const pulled = Object.hasOwn(pulledTimes, record.name)
        ? pulledTimes[record.name]
        : undefined;

      return [
        record.name,
        {
          ...record,
          modifiedAt:
            pulled?.fileTime === record.fileTime
              ? pulled.modifiedAt
              : record.fileTime,
        },
      ];
    }),
  );
}

/** Pulled times of files still unchanged since sync wrote them. */
export function currentPulledTimes(
  local: LocalSyncFiles,
  pulledTimes: PulledFileTimes,
) {
  return Object.fromEntries(
    Object.entries(pulledTimes).filter(
      ([name, times]) => local.get(name)?.fileTime === times.fileTime,
    ),
  );
}

/** Recheck each pull against the documents folder after the network work ends. */
export async function applySyncPulls(
  snapshot: LocalSyncFiles,
  plan: SyncPlan,
  baseline: SyncBaseline,
  pulledTimes: PulledFileTimes,
  getProtectedNames: () => Set<string>,
  onApplied: (change: SyncedFileChange) => void,
) {
  const changes: SyncedFileChange[] = [];

  for (const change of plan.pull) {
    const before = snapshot.get(change.name) ?? null;

    const fileTime = getProtectedNames().has(change.name)
      ? null
      : await applySyncedFile(change.name, before, change.content);

    if (fileTime === null) {
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
      delete pulledTimes[change.name];
    } else {
      pulledTimes[change.name] = { fileTime, modifiedAt: change.modifiedAt };
    }

    const applied = {
      name: change.name,
      before: before?.content ?? null,
      after: change.content,
    };

    changes.push(applied);
    // Refresh buffers even if a later pull or settings write fails.
    onApplied(applied);
  }

  return changes;
}
