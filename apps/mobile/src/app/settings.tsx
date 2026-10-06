import { errorMessage } from "@lunarscribe/utils/error-message";
import { redactEmail } from "@lunarscribe/utils/redact-email";
import { useRouter } from "expo-router";
import {
  Alert,
  Button,
  ListGroup,
  RadioGroup,
  Separator,
  Spinner,
  Typography,
  useThemeColor,
} from "heroui-native";
import { ChevronLeft, RefreshCw } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { ScrollView, View } from "react-native";

import { ColorThemeSelect } from "@/components/color-theme-select";
import {
  cancelSyncSignIn,
  connectSync,
  disconnectSync,
  syncFiles,
} from "@/lib/sync/sync-service";
import { isSyncProvider, SYNC_PROVIDERS } from "@/lib/sync/sync-types";
import type { SyncProvider, SyncStatus } from "@/lib/sync/sync-types";
import { useAppearanceStore } from "@/stores/appearance-store";
import { useSyncStore } from "@/stores/sync-store";

/** Connecting, or signing in again, signs in first and then syncs. */
type ConnectStage = "signing-in" | "syncing";

/** The connected account and the time of the last sync, under the provider name. */
function getConnectionDetails(status: SyncStatus) {
  const lastSync =
    status.lastSyncedAt &&
    `Last sync ${new Date(status.lastSyncedAt).toLocaleString()}`;

  return [status.account && redactEmail(status.account), lastSync]
    .filter(Boolean)
    .join(" · ");
}

/** A small heading above a group of settings, with an optional action at its end. */
function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View className="min-h-8 flex-row items-center justify-between px-1">
      <Typography type="body-sm" color="muted" className="uppercase">
        {title}
      </Typography>
      {action}
    </View>
  );
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

/** Settings screen: the Appearances and Syncing sections, each a grouped list. */
export default function SettingsScreen() {
  const router = useRouter();
  const foreground = useThemeColor("foreground");
  const status = useSyncStore();
  const lightColorTheme = useAppearanceStore((state) => state.lightColorTheme);
  const darkColorTheme = useAppearanceStore((state) => state.darkColorTheme);

  const setLightColorTheme = useAppearanceStore(
    (state) => state.setLightColorTheme,
  );

  const setDarkColorTheme = useAppearanceStore(
    (state) => state.setDarkColorTheme,
  );

  const resetColorThemes = useAppearanceStore(
    (state) => state.resetColorThemes,
  );

  const [selection, setSelection] = useState<SyncProvider>(
    status.provider ?? "google-drive",
  );

  const selected = status.provider ?? selection;

  const [connectStage, setConnectStage] = useState<ConnectStage | null>(null);
  const [isPending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const isDisabled = status.isBusy || isPending;
  const error = status.error ?? failure;

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
      <ScrollView contentContainerClassName="gap-6 p-4">
        <View className="gap-2">
          <SectionHeader
            title="Appearances"
            action={
              (lightColorTheme !== null || darkColorTheme !== null) && (
                <Button variant="ghost" size="sm" onPress={resetColorThemes}>
                  Reset to defaults
                </Button>
              )
            }
          />
          <ListGroup>
            <ColorThemeSelect
              theme="light"
              colorTheme={lightColorTheme}
              onColorThemeChange={setLightColorTheme}
            />
            <Separator className="mx-4" />
            <ColorThemeSelect
              theme="dark"
              colorTheme={darkColorTheme}
              onColorThemeChange={setDarkColorTheme}
            />
          </ListGroup>
        </View>
        <View className="gap-2">
          <SectionHeader title="Syncing" />
          <ListGroup>
            {status.provider ? (
              <ListGroup.Item>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>
                    {SYNC_PROVIDERS[status.provider]}
                  </ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {getConnectionDetails(status) || "Connected"}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
              </ListGroup.Item>
            ) : (
              <RadioGroup
                value={selected}
                isDisabled={isDisabled}
                className="gap-0"
                onValueChange={(value) => {
                  if (isSyncProvider(value)) {
                    setSelection(value);
                  }
                }}
              >
                <RadioGroup.Item value="google-drive" className="p-4">
                  {SYNC_PROVIDERS["google-drive"]}
                </RadioGroup.Item>
                <Separator className="mx-4" />
                <RadioGroup.Item value="dropbox" className="p-4">
                  {SYNC_PROVIDERS.dropbox}
                </RadioGroup.Item>
              </RadioGroup>
            )}
          </ListGroup>
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
          {message && (
            <Typography type="body-sm" color="muted" className="px-1">
              {message}
            </Typography>
          )}
          {error && (
            <Typography type="body-sm" className="text-danger px-1">
              {error}
            </Typography>
          )}
          <Typography type="body-sm" color="muted" className="px-1">
            Notes and drawings are backed up to a lunarscribe-bak-files folder
            every five minutes.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}
