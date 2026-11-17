import { RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { reportFileError } from "@lunarscribe/components/lib/file-feedback";
import {
  SettingsBlock,
  SettingsGroup,
  SettingsPane,
  SettingsRow,
} from "@lunarscribe/components/settings-dialog/settings-pane";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@lunarscribe/components/ui/alert";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lunarscribe/components/ui/select";
import { Spinner } from "@lunarscribe/components/ui/spinner";
import { toast } from "@lunarscribe/components/ui/toast";
import { redactEmail } from "@lunarscribe/utils/redact-email";
import { CLOUD_SYNC_PROVIDERS } from "@lunarscribe/utils/sync/types";
import type {
  CloudSyncProvider,
  SyncStatus,
} from "@lunarscribe/utils/sync/types";
import { useState } from "react";

import { isMac } from "@/lib/platform";
import {
  cancelSyncSignIn,
  connectSync,
  disconnectSync,
  syncFiles,
} from "@/lib/sync/sync-service";
import { useSyncStore } from "@/stores/sync-store";

/** Connecting, or signing in again, signs in first and then syncs. */
type ConnectStage = "signing-in" | "syncing";

function getConnectionLabel(status: SyncStatus) {
  if (!status.provider) {
    return "Sync is off";
  }

  const providerLabel = `Connected to ${CLOUD_SYNC_PROVIDERS[status.provider]}`;

  return status.account
    ? `${providerLabel} · ${redactEmail(status.account)}`
    : providerLabel;
}

/** Tell the user what the slow first connection is waiting on. */
function getConnectMessage(stage: ConnectStage, provider: CloudSyncProvider) {
  if (stage === "syncing") {
    return {
      title: "Syncing your files…",
      description:
        "Right after connecting, this can take a few seconds. You can keep writing while it finishes.",
    };
  }

  return {
    title: `Waiting for you to sign in to ${CLOUD_SYNC_PROVIDERS[provider]}…`,
    description: "Finish signing in in the pop-up window, then come back here.",
  };
}

/** When the last sync ran, and the error that stopped the last one. */
function SyncStatusLine({ status }: { status: SyncStatus }) {
  if (!status.lastSyncedAt && !status.error) {
    return null;
  }

  return (
    <span aria-live="polite" className="flex flex-col gap-0.5">
      {status.lastSyncedAt && (
        <span>Last sync: {new Date(status.lastSyncedAt).toLocaleString()}</span>
      )}
      {status.error && (
        <span className="text-destructive select-text">{status.error}</span>
      )}
    </span>
  );
}

export function SyncingPane() {
  const status = useSyncStore();

  const [selection, setSelected] = useState<CloudSyncProvider>(
    status.provider ?? "google-drive",
  );

  const selected = status.provider ?? selection;

  const [connectStage, setConnectStage] = useState<ConnectStage | null>(null);
  const [isPending, setPending] = useState(false);

  const isDisabled = status.isBusy || isPending;

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
    <SettingsPane>
      <SettingsGroup
        title="Sync"
        description="Back up your saved notes and drawings and keep them the same on all your devices. Lunarscribe syncs every five minutes while a tab is open."
      >
        <SettingsRow
          title="Provider"
          htmlFor="sync-provider"
          description={`You will sign in to ${CLOUD_SYNC_PROVIDERS[selected]} in a pop-up window. Lunarscribe saves your files in a folder called lunarscribe-bak-files. Your sign-in stays in this browser.`}
        >
          <Select<CloudSyncProvider>
            items={CLOUD_SYNC_PROVIDERS}
            value={selected}
            disabled={isDisabled || status.provider !== null}
            onValueChange={(value) => {
              if (value) {
                setSelected(value);
              }
            }}
          >
            <SelectTrigger id="sync-provider" className="w-56 justify-between">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="google-drive">
                {CLOUD_SYNC_PROVIDERS["google-drive"]}
              </SelectItem>
              <SelectItem value="dropbox">
                {CLOUD_SYNC_PROVIDERS.dropbox}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          title={<span aria-live="polite">{getConnectionLabel(status)}</span>}
          description={<SyncStatusLine status={status} />}
        >
          {status.provider ? (
            <>
              {status.isSignInRequired && (
                <Button
                  size="sm"
                  disabled={isDisabled}
                  onClick={() => {
                    void connect();
                  }}
                >
                  Sign in again
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => {
                  void disconnect();
                }}
              >
                Disconnect
              </Button>
              <Button
                size="sm"
                disabled={isDisabled}
                onClick={() => {
                  void sync();
                }}
              >
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
                {status.isBusy && !connectStage ? "Syncing…" : "Sync now"}
              </Button>
            </>
          ) : (
            <>
              {connectStage === "signing-in" && (
                <Button variant="outline" size="sm" onClick={cancelSyncSignIn}>
                  Cancel sign-in
                </Button>
              )}
              <Button
                size="sm"
                disabled={isDisabled}
                onClick={() => {
                  void connect();
                }}
              >
                {connectStage
                  ? "Connecting…"
                  : `Connect ${CLOUD_SYNC_PROVIDERS[selected]}`}
              </Button>
            </>
          )}
        </SettingsRow>
        {connectMessage && (
          <SettingsBlock>
            <Alert>
              <Spinner aria-hidden="true" />
              <AlertTitle>{connectMessage.title}</AlertTitle>
              <AlertDescription>{connectMessage.description}</AlertDescription>
            </Alert>
          </SettingsBlock>
        )}
      </SettingsGroup>
      <SettingsGroup title="How syncing works">
        <SettingsBlock>
          <p className="text-muted-foreground text-sm text-pretty">
            Press {isMac ? "Cmd+S" : "Ctrl+S"} to save the open file and sync it
            right away. Files opened from outside Lunarscribe are not synced.
          </p>
          <p className="text-muted-foreground text-sm text-pretty">
            If a note changed on two devices, Lunarscribe keeps both copies and
            lets you know. On the first sync, the most recently edited copy is
            kept.
          </p>
          {selected === "google-drive" && (
            <p className="text-muted-foreground text-sm text-pretty">
              Google Drive asks you to sign in again about once an hour. Syncing
              picks up again after you sign in.
            </p>
          )}
        </SettingsBlock>
      </SettingsGroup>
    </SettingsPane>
  );
}
