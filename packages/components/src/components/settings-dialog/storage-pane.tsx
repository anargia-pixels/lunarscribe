import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmationDialog } from "@lunarscribe/components/confirmation-dialog/confirmation-dialog";
import { Button } from "@lunarscribe/components/ui/button";
import { useState } from "react";

import { SettingsPane } from "./settings-pane";

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

/**
 * Lists the app state each store keeps across launches and how much space it takes, with
 * a way to clear it all when something goes wrong. Clearing reloads the app, so stores
 * start over from their defaults. `keptNote` says what clearing leaves alone.
 */
export function StoragePane({
  stores,
  keptNote,
}: {
  stores: readonly PersistedStore[];
  keptNote: string;
}) {
  const [sizes] = useState(() => stores.map(storedBytes));
  const [isConfirming, setIsConfirming] = useState(false);
  const total = sizes.reduce((sum, size) => sum + size, 0);

  function clearAll() {
    for (const store of stores) {
      store.persist.clearStorage();
    }

    // In-memory state would otherwise be written straight back on the next change.
    window.location.reload();
  }

  return (
    <SettingsPane>
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Storage</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          Settings and app state Lunarscribe remembers between launches, using{" "}
          {formatBytes(total)} in total. {keptNote}
        </p>
      </header>
      <dl className="flex flex-col gap-3 text-sm">
        {stores.map((store, index) => (
          <div key={store.label} className="flex items-baseline gap-6">
            <div className="min-w-0 flex-1">
              <dt>{store.label}</dt>
              <dd className="text-muted-foreground text-pretty">
                {store.description}
              </dd>
            </div>
            <dd className="text-muted-foreground shrink-0 tabular-nums">
              {formatBytes(sizes[index] ?? 0)}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <Button variant="destructive" onClick={() => setIsConfirming(true)}>
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          Clear app storage
        </Button>
      </div>
      <ConfirmationDialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title="Clear app storage?"
        description={`Lunarscribe forgets everything listed here and reloads with default settings. ${keptNote} Untitled buffers that were never saved are lost.`}
        confirmLabel="Clear and reload"
        onConfirm={clearAll}
      />
    </SettingsPane>
  );
}
