import { Button } from "@lunarscribe/components/ui/button";
import { Label } from "@lunarscribe/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lunarscribe/components/ui/select";
import { Separator } from "@lunarscribe/components/ui/separator";
import { toast } from "@lunarscribe/components/ui/toast";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { reportFileError } from "@/lib/file-feedback";
import { SYNC_PROVIDERS } from "@/lib/sync";
import type { SyncProvider, SyncStatus } from "@/lib/sync";
import { useSyncStore } from "@/stores/sync-store";

function getConnectionLabel(status: SyncStatus) {
  if (!status.provider) {
    return "Sync is off";
  }

  const providerLabel = `Connected to ${SYNC_PROVIDERS[status.provider]}`;

  return status.account
    ? `${providerLabel} · ${status.account}`
    : providerLabel;
}

export function SyncingPane() {
  const status = useSyncStore();

  const [selection, setSelected] = useState<SyncProvider>(
    status.provider ?? "github",
  );

  const selected = status.provider ?? selection;

  const [isConnecting, setConnecting] = useState(false);
  const [isPending, setPending] = useState(false);

  const isDisabled = status.busy || isPending;

  async function connect() {
    setConnecting(true);
    setPending(true);

    try {
      useSyncStore.setState(await window.lunarscribe.connectSync(selected));
      await window.lunarscribe.syncFiles(null);
    } catch (cause) {
      if (!useSyncStore.getState().error) {
        reportFileError(
          cause,
          "Unable to connect sync",
          "Try connecting again after the current sync finishes.",
        );
      }
    } finally {
      setConnecting(false);
      setPending(false);
    }
  }

  async function sync() {
    setPending(true);

    try {
      const result = await window.lunarscribe.syncFiles(null);

      if (!result.conflicts.length) {
        toast.add({
          type: "success",
          title: "Sync complete",
          description: `${result.pushed} pushed, ${result.pulled} pulled.`,
        });
      }
    } catch (cause) {
      if (!useSyncStore.getState().error) {
        reportFileError(
          cause,
          "Unable to sync",
          "Try again after the current sync finishes.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    setPending(true);

    try {
      useSyncStore.setState(await window.lunarscribe.disconnectSync());
    } catch (cause) {
      if (!useSyncStore.getState().error) {
        reportFileError(
          cause,
          "Unable to disconnect sync",
          "Try again after the current sync finishes.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Syncing</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          Sync saved markdown and drawings across devices. One provider runs
          every five minutes while Lunarscribe is open.
        </p>
      </header>
      <div className="flex max-w-lg flex-col gap-4">
        <div className="flex items-center justify-between gap-6">
          <Label htmlFor="sync-provider">Provider</Label>
          <Select<SyncProvider>
            items={SYNC_PROVIDERS}
            value={selected}
            disabled={isDisabled || status.provider !== null}
            onValueChange={(value) => {
              if (value) {
                setSelected(value);
              }
            }}
          >
            <SelectTrigger id="sync-provider" className="w-64 justify-between">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="github">{SYNC_PROVIDERS.github}</SelectItem>
              <SelectItem value="google-drive">
                {SYNC_PROVIDERS["google-drive"]}
              </SelectItem>
              <SelectItem value="dropbox">{SYNC_PROVIDERS.dropbox}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          {selected === "github"
            ? "Requires Git 2.38 or newer and gh, with gh auth login completed. Connect finds lunarscribe-bak-files or creates it as a private repository. Git history is stored in Documents/lunarscribe; disconnect removes that history and keeps saved files."
            : `Sign in to ${SYNC_PROVIDERS[selected]} in your browser. Lunarscribe finds or creates the lunarscribe-bak-files folder. Credentials are saved in the user data folder.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {status.provider ? (
            <>
              {status.needsSignIn && (
                <Button
                  disabled={isDisabled}
                  onClick={() => {
                    void connect();
                  }}
                >
                  Sign in again
                </Button>
              )}
              <Button
                disabled={isDisabled}
                onClick={() => {
                  void sync();
                }}
              >
                <RefreshCw />
                {status.busy && !isConnecting ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                variant="outline"
                disabled={isDisabled}
                onClick={() => {
                  void disconnect();
                }}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              disabled={isDisabled}
              onClick={() => {
                void connect();
              }}
            >
              {isConnecting
                ? "Connecting…"
                : `Connect ${SYNC_PROVIDERS[selected]}`}
            </Button>
          )}
          {isConnecting && selected !== "github" && (
            <Button
              variant="outline"
              onClick={() => window.lunarscribe.cancelSyncSignIn()}
            >
              Cancel sign-in
            </Button>
          )}
        </div>
        <div aria-live="polite" className="flex flex-col gap-1 text-sm">
          <p>{getConnectionLabel(status)}</p>
          {status.lastSyncedAt && (
            <p className="text-muted-foreground">
              Last sync: {new Date(status.lastSyncedAt).toLocaleString()}
            </p>
          )}
          {status.error && <p className="text-destructive">{status.error}</p>}
        </div>
        <Separator />
        <p className="text-muted-foreground text-sm text-pretty">
          Press {window.lunarscribe.platform === "darwin" ? "Cmd+S" : "Ctrl+S"}{" "}
          to save and push the active saved file. External files stay local.{" "}
          {selected === "github"
            ? "GitHub checks incoming merges before pulling. Compatible markdown edits merge automatically; conflicts preserve both versions and show a toast."
            : "Different local and remote versions are preserved with a toast. On the first sync, existing copies must match or be kept under different names."}
        </p>
        {selected === "google-drive" && (
          <p className="text-muted-foreground text-sm text-pretty">
            Google Drive asks for browser sign-in when its access token expires.
            Background sync resumes after you sign in again.
          </p>
        )}
      </div>
    </div>
  );
}
