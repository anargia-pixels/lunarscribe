import { createHash } from "node:crypto";

import type { SyncBaseline } from "../../lib/sync";
import type { RemoteChange, RemoteFiles } from "./provider";

export type SyncPlan = {
  push: RemoteChange[];
  pull: RemoteChange[];
  conflicts: string[];
  acknowledged: SyncBaseline;
};

export function contentHash(content: string) {
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
  const conflicts: string[] = [];
  const acknowledged: SyncBaseline = { ...baseline };

  const names =
    pushName === null
      ? new Set([...local.keys(), ...remote.keys(), ...Object.keys(baseline)])
      : new Set([pushName]);

  for (const name of names) {
    if (blockedNames.has(name) || remote.get(name)?.blocked) {
      conflicts.push(name);

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

    if (
      (localChanged && remoteChanged) ||
      (remoteChanged && (pushName !== null || protectedNames.has(name)))
    ) {
      conflicts.push(name);

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
