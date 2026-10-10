import { reportFileError } from "@lunarscribe/components/lib/file-feedback";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@lunarscribe/components/ui/alert";
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
import { Spinner } from "@lunarscribe/components/ui/spinner";
import { toast } from "@lunarscribe/components/ui/toast";
import { redactEmail } from "@lunarscribe/utils/redact-email";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { isMac } from "@/lib/platform";
import {
  cancelSyncSignIn,
  connectSync,
  disconnectSync,
  syncFiles,
} from "@/lib/sync/sync-service";
import { SYNC_PROVIDERS } from "@/lib/sync/sync-types";
import type { SyncProvider, SyncStatus } from "@/lib/sync/sync-types";
import { useSyncStore } from "@/stores/sync-store";

/** Connecting, or signing in again, signs in first and then syncs. */
type ConnectStage = "signing-in" | "syncing";

function getConnectionLabel(status: SyncStatus) {
  if (!status.provider) {
    return "Sync is off";
  }

  const providerLabel = `Connected to ${SYNC_PROVIDERS[status.provider]}`;

  return status.account
    ? `${providerLabel} · ${redactEmail(status.account)}`
    : providerLabel;
}

/** Tell the user what the slow first connection is waiting on. */
function getConnectMessage(stage: ConnectStage, provider: SyncProvider) {
  if (stage === "syncing") {
    return {
      title: "Syncing your files…",
      description:
        "Right after connecting, this can take a few seconds. You can keep writing while it finishes.",
    };
  }

  return {
    title: `Waiting for you to sign in to ${SYNC_PROVIDERS[provider]}…`,
    description: "Finish signing in in the pop-up window, then come back here.",
  };
}

export function SyncingPane() {
  const status = useSyncStore();

  const [selection, setSelected] = useState<SyncProvider>(
    status.provider ?? "google-drive",
  );

  const selected = status.provider ?? selection;

  const [connectStage, setConnectStage] = useState<ConnectStage | null>(null);
  const [isPending, setPending] = useState(false);

  const isDisabled = status.busy || isPending;

  const connectMessage =
    connectStage && getConnectMessage(connectStage, selected);

  async function connect() {
    setConnectStage("signing-in");
    setPending(true);

    try {
      useSyncStore.setState(await connectSync(selected));
      setConnectStage("syncing");
      await syncFiles(null);
    } catch (cause) {
      if (!useSyncStore.getState().error) {
        reportFileError(
          cause,
          "Unable to connect sync",
          "Try connecting again after the current sync finishes.",
        );
      }
    } finally {
      setConnectStage(null);
      setPending(false);
    }
  }

  async function sync() {
    setPending(true);

    try {
      const result = await syncFiles(null);

      if (!result.conflicts.length) {
        toast.add({
          type: "success",
          title: "Sync complete",
          description: `${result.pushed} sent, ${result.pulled} received.`,
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
      useSyncStore.setState(await disconnectSync());
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
          Back up your saved notes and drawings and keep them the same on all
          your devices. Lunarscribe syncs every five minutes while a tab is
          open.
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
              <SelectItem value="google-drive">
                {SYNC_PROVIDERS["google-drive"]}
              </SelectItem>
              <SelectItem value="dropbox">{SYNC_PROVIDERS.dropbox}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          {`You will sign in to ${SYNC_PROVIDERS[selected]} in a pop-up window. Lunarscribe saves your files in a folder called lunarscribe-bak-files. Your sign-in stays in this browser.`}
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
                {status.busy && !connectStage ? "Syncing…" : "Sync now"}
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
              {connectStage
                ? "Connecting…"
                : `Connect ${SYNC_PROVIDERS[selected]}`}
            </Button>
          )}
          {connectStage === "signing-in" && (
            <Button variant="outline" onClick={cancelSyncSignIn}>
              Cancel sign-in
            </Button>
          )}
        </div>
        {connectMessage && (
          <Alert>
            <Spinner aria-hidden="true" />
            <AlertTitle>{connectMessage.title}</AlertTitle>
            <AlertDescription>{connectMessage.description}</AlertDescription>
          </Alert>
        )}
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
          Press {isMac ? "Cmd+S" : "Ctrl+S"} to save the open file and sync it
          right away. Files opened from outside Lunarscribe are not synced. If a
          note changed on two devices, Lunarscribe keeps both copies and lets
          you know. On the first sync, the most recently edited copy is kept.
        </p>
        {selected === "google-drive" && (
          <p className="text-muted-foreground text-sm text-pretty">
            Google Drive asks you to sign in again about once an hour. Syncing
            picks up again after you sign in.
          </p>
        )}
      </div>
    </div>
  );
}
