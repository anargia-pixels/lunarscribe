import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmationDialog } from "@lunarscribe/components/confirmation-dialog/confirmation-dialog";
import { Button } from "@lunarscribe/components/ui/button";
import { useState } from "react";

import { SettingsGroup, SettingsPane, SettingsRow } from "./settings-pane";

/** A zustand store saved with `persist`; only the parts of its persist API the pane uses. */
export type PersistedStore = {
  label: string;
  description: string;
  persist: {
    getOptions: () => { name?: string };
    clearStorage: () => void;
  };
};

/** Bytes a store takes in localStorage, which keeps keys and values as UTF-16. */
function storedBytes(store: PersistedStore) {
  const name = store.persist.getOptions().name;

  if (!name) {
    return 0;
  }

  return (name.length + (localStorage.getItem(name)?.length ?? 0)) * 2;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** What a confirmation clears: one store, or every store. */
type ClearTarget = { kind: "store"; store: PersistedStore } | { kind: "all" };

/**
 * Lists the app state each store keeps across launches and how much space it
 * takes. Each store can be cleared on its own, or all of them at once when
 * something goes wrong. Clearing reloads the app, so cleared stores start over
 * from their defaults. `keptNote` says what clearing leaves alone.
 */
export function StoragePane({
  stores,
  keptNote,
  reload,
}: {
  stores: readonly PersistedStore[];
  keptNote: string;
  /** Reloads the app; the desktop window cannot reload itself with `location.reload()`. */
  reload: () => void;
}) {
  const [sizes] = useState(() => stores.map(storedBytes));
  const [target, setTarget] = useState<ClearTarget | null>(null);
  const total = sizes.reduce((sum, size) => sum + size, 0);

  function clear(cleared: ClearTarget) {
    for (const store of cleared.kind === "all" ? stores : [cleared.store]) {
      store.persist.clearStorage();
    }

    // In-memory state would otherwise be written straight back on the next change.
    reload();
  }

  const confirmation =
    target?.kind === "store"
      ? {
          title: `Clear ${target.store.label.toLowerCase()}?`,
          description: `${target.store.label}: ${target.store.description} Lunarscribe forgets this and reloads, so untitled buffers that were never saved are lost. ${keptNote}`,
          confirmLabel: "Clear and reload",
        }
      : {
          title: "Clear all app storage?",
          description: `Lunarscribe forgets everything listed here and reloads with default settings. Untitled buffers that were never saved are lost. ${keptNote}`,
          confirmLabel: "Clear all and reload",
        };

  return (
    <SettingsPane>
      <SettingsGroup
        title="App state"
        description={
          <>
            Settings and app state Lunarscribe remembers between launches, using{" "}
            <span className="tabular-nums">{formatBytes(total)}</span> in total.{" "}
            {keptNote}
          </>
        }
      >
        {stores.map((store, index) => (
          <SettingsRow
            key={store.label}
            title={store.label}
            description={store.description}
          >
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatBytes(sizes[index] ?? 0)}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Clear ${store.label}`}
              onClick={() => setTarget({ kind: "store", store })}
            >
              Clear
            </Button>
          </SettingsRow>
        ))}
      </SettingsGroup>
      <SettingsGroup title="Reset">
        <SettingsRow
          title="Clear all app storage"
          description="Forget everything above at once and start over with default settings."
        >
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setTarget({ kind: "all" })}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            Clear all
          </Button>
        </SettingsRow>
      </SettingsGroup>
      <ConfirmationDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
          }
        }}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        onConfirm={() => {
          if (target !== null) {
            clear(target);
          }
        }}
      />
    </SettingsPane>
  );
}
