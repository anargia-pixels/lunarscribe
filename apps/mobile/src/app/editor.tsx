import { Redirect, useRouter } from "expo-router";
import { Typography, useThemeColor } from "heroui-native";
import { ChevronLeft } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";

import { DarkmodeToggle } from "@/components/darkmode-toggle";
import { EditorSlot } from "@/components/editor-host";
import { FileErrorAlert } from "@/components/file-error-alert";
import { PressableButton } from "@/components/pressable-button";
import { BUFFER_EXTENSIONS } from "@/lib/editor-files";
import { syncFiles } from "@/lib/sync/sync-service";
import { useActiveBuffer, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

/** Editor screen for the active buffer. */
export default function EditorScreen() {
  const router = useRouter();
  const buffer = useActiveBuffer();
  const foreground = useThemeColor("foreground");
  const bufferId = buffer?.id;

  // Leaving the screen writes pending edits, then syncs the saved file.
  useEffect(() => {
    if (!bufferId) {
      return;
    }

    return () => {
      useBufferStore
        .getState()
        .flushBuffer(bufferId)
        .then(
          () => {
            // Read after the flush, which names a buffer on its first save.
            const fileName = useBufferStore
              .getState()
              .buffers.find((candidate) => candidate.id === bufferId)?.fileName;

            if (fileName && useSyncStore.getState().provider) {
              // A sync already running covers this file; failures show in the sync alert.
              syncFiles(fileName).catch(() => undefined);
            }
          },
          (error) => useBufferStore.setState({ fileError: String(error) }),
        );
    };
  }, [bufferId]);

  if (!buffer) {
    return <Redirect href="/" />;
  }

  const fileName =
    buffer.fileName ?? `${buffer.title}${BUFFER_EXTENSIONS[buffer.kind]}`;

  return (
    <View className="bg-background pt-safe pb-safe flex-1">
      <View className="border-border h-12 flex-row items-center gap-1 border-b px-2">
        <PressableButton
          variant="ghost"
          size="sm"
          isIconOnly
          accessibilityLabel="Back to files"
          onPress={() => router.back()}
        >
          <ChevronLeft size={20} color={foreground} />
        </PressableButton>
        <Typography
          type="body-sm"
          align="center"
          truncate
          accessibilityLabel="File path"
          className="flex-1"
        >
          {`lunarscribe / ${fileName}`}
        </Typography>
        <DarkmodeToggle />
      </View>
      <FileErrorAlert />
      <EditorSlot kind={buffer.kind} />
    </View>
  );
}
