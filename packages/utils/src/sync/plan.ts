import { sha256Hex } from "./hash";
import type { ContentHash } from "./hash";
import type {
  FileSyncProvider,
  RemoteChange,
  RemoteFiles,
  SyncBaseline,
  SyncConflict,
  SyncContent,
  SyncedFileChange,
  SyncResult,
} from "./types";

// Local files
/** A saved file as sync read it; `blocked` marks a path that is not a regular file. */
export type LocalSyncFile = {
  content: SyncContent;
  modifiedAt: number;
  blocked?: boolean;
};

export type LocalSyncFiles = Map<string, LocalSyncFile>;

/** Each app's access to its saved files. Both methods run inside its save queue. */
export type LocalSyncStore<File extends LocalSyncFile = LocalSyncFile> = {
  /** Read every synced file, or only `name`. */
  read: (name: string | null) => Promise<Map<string, File>>;
  /**
   * Write `change` only when the file still matches `before`, so an edit made during
   * the sync is never lost. Returns false and writes nothing when the file changed.
   */
  apply: (change: RemoteChange, before: File | null) => Promise<boolean>;
};

type SyncPlan = {
  push: RemoteChange[];
  pull: RemoteChange[];
  conflicts: SyncConflict[];
  acknowledged: SyncBaseline;
};

// Comparison
/** Compare with the shared base; never pull an older remote file over local edits. */
async function planSync(
  local: LocalSyncFiles,
  remote: RemoteFiles,
  baseline: SyncBaseline,
  protectedNames: Set<string>,
  pushName: string | null,
  hash: ContentHash = sha256Hex,
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
    if (local.get(name)?.blocked || remote.get(name)?.blocked) {
      conflicts.push({
        name,
        reason:
          "This path is not a regular saved file. Both copies were preserved.",
      });

      continue;
    }

    const localContent = local.get(name)?.content ?? null;
    const remoteContent = remote.get(name)?.content ?? null;
    const localHash = localContent === null ? null : await hash(localContent);

    const remoteHash =
      remoteContent === null ? null : await hash(remoteContent);

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

/** Text changes for buffers; images are read again when the editor resolves them. */
export function toTextChange(
  name: string,
  before: SyncContent | null,
  after: SyncContent | null,
): SyncedFileChange | null {
  return before instanceof Uint8Array || after instanceof Uint8Array
    ? null
    : { name, before, after };
}

// Sync operations
/**
 * Sync every file, or push only `name`, with a cloud provider. Reports each applied text
 * change through `onApplied` at once, so buffers refresh even if a later step fails.
 * Returns the result and the baseline to store.
 */
export async function syncWithCloud<File extends LocalSyncFile>(
  remoteProvider: FileSyncProvider,
  local: LocalSyncStore<File>,
  baseline: SyncBaseline,
  getProtectedNames: () => Set<string>,
  name: string | null,
  onApplied: (change: SyncedFileChange) => void,
  hash: ContentHash = sha256Hex,
) {
  // Plan: compare both sides, then push before anything local changes.
  const remote = await remoteProvider.read(name);
  const snapshot = await local.read(null);

  const plan = await planSync(
    snapshot,
    remote,
    baseline,
    getProtectedNames(),
    name,
    hash,
  );

  await remoteProvider.write(plan.push, remote);

  // Pull: recheck each file, since buffers may have saved during the network work.
  let pulled = 0;

  for (const change of plan.pull) {
    const before = snapshot.get(change.name) ?? null;

    const isApplied =
      !getProtectedNames().has(change.name) &&
      (await local.apply(change, before));

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

    pulled += 1;

    const applied = toTextChange(
      change.name,
      before?.content ?? null,
      change.content,
    );

    if (applied) {
      onApplied(applied);
    }
  }

  const result: SyncResult = {
    conflicts: plan.conflicts,
    pushed: plan.push.length,
    pulled,
  };

  return { result, baseline: plan.acknowledged };
}

/** Overwrite the remote copy of `name` with the saved file and acknowledge it. */
export async function forcePushFile<File extends LocalSyncFile>(
  remoteProvider: FileSyncProvider,
  local: LocalSyncStore<File>,
  baseline: SyncBaseline,
  name: string,
  hash: ContentHash = sha256Hex,
) {
  const file = (await local.read(name)).get(name);

  if (!file) {
    throw new Error(`The saved file "${name}" no longer exists.`);
  }

  if (file.blocked) {
    throw new Error(`"${name}" is not a regular saved file.`);
  }

  await remoteProvider.forceWrite(name, file.content, file.modifiedAt);
  baseline[name] = await hash(file.content);
}

/**
 * Replace the saved file `name` with the remote copy, or remove it when the remote has
 * none, and acknowledge the result. Returns the text change for its buffer.
 */
export async function forcePullFile<File extends LocalSyncFile>(
  remoteProvider: FileSyncProvider,
  local: LocalSyncStore<File>,
  baseline: SyncBaseline,
  name: string,
  hash: ContentHash = sha256Hex,
): Promise<SyncedFileChange> {
  const remote = (await remoteProvider.read(name)).get(name) ?? null;

  if (remote?.blocked) {
    throw new Error(
      "The remote copy is not a regular saved file, so it cannot replace the local copy.",
    );
  }

  const before = (await local.read(name)).get(name) ?? null;

  // Force pull is a file list action, so it only reaches markdown and drawings.
  const change = toTextChange(
    name,
    before?.content ?? null,
    remote?.content ?? null,
  );

  if (!change || before?.blocked) {
    throw new Error("Only saved markdown and drawings can be pulled.");
  }

  const isApplied = await local.apply(
    remote
      ? { name, content: remote.content, modifiedAt: remote.modifiedAt }
      : { name, content: null },
    before,
  );

  if (!isApplied) {
    throw new Error("The saved file changed while pulling. Retry.");
  }

  if (remote) {
    baseline[name] = await hash(remote.content);
  } else {
    delete baseline[name];
  }

  return change;
}
