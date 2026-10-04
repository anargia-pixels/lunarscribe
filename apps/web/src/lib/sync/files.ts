import type { SavedFileRecord } from "@/lib/browser-database";
import { getFileExtension } from "@/lib/editor-files";
import { applySyncedFile, readAllFiles } from "@/lib/saved-files";
import type {
  SyncBaseline,
  SyncConflict,
  SyncedFileChange,
} from "@/lib/sync/sync-types";
import type { RemoteChange, RemoteFiles } from "@/lib/sync/types";

// Sync comparisons
/** Saved files by name, as read from browser storage when the sync started. */
export type LocalSyncFiles = Map<string, SavedFileRecord>;

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
export async function contentHash(content: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
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
/** Read saved files inside the same queue that processes local saves. */
export async function readLocalSyncFiles(): Promise<LocalSyncFiles> {
  return new Map(
    (await readAllFiles())
      .filter((record) => getFileExtension(record.name) !== null)
      .map((record) => [record.name, record]),
  );
}

/** Recheck each pull against browser storage after the network work ends. */
export async function applySyncPulls(
  snapshot: LocalSyncFiles,
  plan: SyncPlan,
  baseline: SyncBaseline,
  getProtectedNames: () => Set<string>,
  onApplied: (change: SyncedFileChange) => void,
) {
  const changes: SyncedFileChange[] = [];

  for (const change of plan.pull) {
    const before = snapshot.get(change.name) ?? null;

    const isApplied =
      !getProtectedNames().has(change.name) &&
      (await applySyncedFile(
        change.name,
        before,
        change.content,
        change.content === null ? 0 : change.modifiedAt,
      ));

    if (!isApplied) {
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
