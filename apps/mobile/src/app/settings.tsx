import { errorMessage } from "@lunarscribe/utils/error-message";
import { redactEmail } from "@lunarscribe/utils/redact-email";
import { useRouter } from "expo-router";
import {
  Alert,
  Button,
  RadioGroup,
  Separator,
  Spinner,
  Typography,
  useThemeColor,
} from "heroui-native";
import { ChevronLeft, RefreshCw } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import {
  cancelSyncSignIn,
  connectSync,
  disconnectSync,
  syncFiles,
} from "@/lib/sync/sync-service";
import { isSyncProvider, SYNC_PROVIDERS } from "@/lib/sync/sync-types";
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
    description: "Finish signing in in the browser, then come back here.",
  };
}

/** Settings screen; for now it holds the Syncing section. */
export default function SettingsScreen() {
  const router = useRouter();
  const foreground = useThemeColor("foreground");
  const status = useSyncStore();

  const [selection, setSelection] = useState<SyncProvider>(
    status.provider ?? "google-drive",
  );

  const selected = status.provider ?? selection;

  const [connectStage, setConnectStage] = useState<ConnectStage | null>(null);
  const [isPending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const isDisabled = status.isBusy || isPending;

  const connectMessage =
    connectStage && getConnectMessage(connectStage, selected);

  /** Runs one sync action; failures the service did not record show inline. */
  async function run(action: () => Promise<void>, fallback: string) {
    setPending(true);
    setMessage(null);
    setFailure(null);

    try {
      await action();
    } catch (cause) {
      if (!useSyncStore.getState().error) {
        setFailure(errorMessage(cause, fallback));
      }
    } finally {
      setConnectStage(null);
      setPending(false);
    }
  }

  const connect = () =>
    run(async () => {
      setConnectStage("signing-in");
      useSyncStore.setState(await connectSync(selected));
      setConnectStage("syncing");
      await syncFiles(null);
    }, "Unable to connect sync. Try again after the current sync finishes.");

  const sync = () =>
    run(async () => {
      const syncResult = await syncFiles(null);

      if (!syncResult.conflicts.length) {
        setMessage(
          `Sync complete: ${syncResult.pushed} sent, ${syncResult.pulled} received.`,
        );
      }
    }, "Unable to sync. Try again after the current sync finishes.");

  const disconnect = () =>
    run(async () => {
      useSyncStore.setState(await disconnectSync());
    }, "Unable to disconnect sync. Try again after the current sync finishes.");

  return (
    <View className="bg-background pt-safe pb-safe flex-1">
      <View className="border-border h-12 flex-row items-center gap-1 border-b px-2">
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          accessibilityLabel="Back to files"
          onPress={() => router.back()}
        >
          <ChevronLeft size={20} color={foreground} />
        </Button>
        <Typography.Heading type="h5" className="flex-1">
          Settings
        </Typography.Heading>
      </View>
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="gap-1">
          <Typography.Heading type="h6">Syncing</Typography.Heading>
          <Typography type="body-sm" color="muted">
            Back up your saved notes and drawings and keep them the same on all
            your devices. Lunarscribe syncs when it opens, every five minutes
            while it is open, and when you return to it.
          </Typography>
        </View>
        <RadioGroup
          value={selected}
          isDisabled={isDisabled || status.provider !== null}
          onValueChange={(value) => {
            if (isSyncProvider(value)) {
              setSelection(value);
            }
          }}
        >
          <RadioGroup.Item value="google-drive">
            {SYNC_PROVIDERS["google-drive"]}
          </RadioGroup.Item>
          <RadioGroup.Item value="dropbox">
            {SYNC_PROVIDERS.dropbox}
          </RadioGroup.Item>
        </RadioGroup>
        <Typography type="body-sm" color="muted">
          {`You will sign in to ${SYNC_PROVIDERS[selected]} in the browser. Lunarscribe saves your files in a folder called lunarscribe-bak-files. Your sign-in stays on this device.`}
        </Typography>
        <View className="flex-row flex-wrap gap-2">
          {status.provider ? (
            <>
              {status.isSignInRequired && (
                <Button isDisabled={isDisabled} onPress={connect}>
                  Sign in again
                </Button>
              )}
              <Button isDisabled={isDisabled} onPress={sync}>
                <RefreshCw size={16} color={foreground} />
                <Button.Label>
                  {status.isBusy && !connectStage ? "Syncing…" : "Sync now"}
                </Button.Label>
              </Button>
              <Button
                variant="outline"
                isDisabled={isDisabled}
                onPress={disconnect}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button isDisabled={isDisabled} onPress={connect}>
              {connectStage
                ? "Connecting…"
                : `Connect ${SYNC_PROVIDERS[selected]}`}
            </Button>
          )}
          {connectStage === "signing-in" && (
            <Button variant="outline" onPress={cancelSyncSignIn}>
              Cancel sign-in
            </Button>
          )}
        </View>
        {connectMessage && (
          <Alert>
            <Spinner size="sm" />
            <Alert.Content>
              <Alert.Title>{connectMessage.title}</Alert.Title>
              <Alert.Description>
                {connectMessage.description}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <View className="gap-1">
          <Typography type="body-sm">{getConnectionLabel(status)}</Typography>
          {status.lastSyncedAt && (
            <Typography type="body-sm" color="muted">
              {`Last sync: ${new Date(status.lastSyncedAt).toLocaleString()}`}
            </Typography>
          )}
          {message && (
            <Typography type="body-sm" color="muted">
              {message}
            </Typography>
          )}
          {(status.error ?? failure) && (
            <Typography type="body-sm" className="text-danger">
              {status.error ?? failure}
            </Typography>
          )}
        </View>
        <Separator />
        <Typography type="body-sm" color="muted">
          Leaving the editor saves the open file and syncs it right away. If a
          note changed on two devices, Lunarscribe keeps both copies and lets
          you know. On the first sync, the most recently edited copy is kept.
        </Typography>
      </ScrollView>
    </View>
  );
}
