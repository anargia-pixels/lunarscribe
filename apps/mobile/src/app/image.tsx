import { imageMimeType } from "@lunarscribe/utils/images";
import { baseNameOf } from "@lunarscribe/utils/saved-paths";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Typography, useThemeColor } from "heroui-native";
import { ChevronLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { DarkmodeToggle } from "@/components/darkmode-toggle";
import { PressableButton } from "@/components/pressable-button";
import { imageUri, readSvg } from "@/lib/documents-folder";
import { useBufferStore } from "@/stores/buffer-store";

/** The saved SVG's markup, read again when `name` changes; null while it loads. */
function useSvgMarkup(name: string, isSvg: boolean) {
  const [svg, setSvg] = useState<{ name: string; xml: string } | null>(null);

  useEffect(() => {
    if (!isSvg) {
      return;
    }

    let isCurrent = true;

    readSvg(name).then(
      (xml) => isCurrent && setSvg({ name, xml }),
      () => isCurrent && setSvg({ name, xml: "" }),
    );

    return () => {
      isCurrent = false;
    };
  }, [name, isSvg]);

  return svg?.name === name ? svg.xml : null;
}

/**
 * A saved image on its own, fit to the screen at its aspect ratio, as Obsidian opens an
 * image file. Images are read only; the file list renames, moves, and deletes them.
 */
export default function ImageScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const foreground = useThemeColor("foreground");
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const isSvg = imageMimeType(name) === "image/svg+xml";
  const svg = useSvgMarkup(name, isSvg);

  // The file list refreshes after renames, moves, deletes, and syncs.
  useBufferStore((state) => state.entries);

  const uri = imageUri(name);
  const isMissing = uri === null;
  const hasFailed = uri !== null && (failedUri === uri || svg === "");

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
          {`lunarscribe / ${name}`}
        </Typography>
        <DarkmodeToggle />
      </View>
      {isMissing || hasFailed ? (
        <Alert status="warning" className="m-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {isMissing ? "Image not found" : "Image couldn't open"}
            </Alert.Title>
            <Alert.Description>
              {isMissing
                ? `“${baseNameOf(name)}” was moved or deleted.`
                : `“${baseNameOf(name)}” may be damaged or saved in a format this device can't show.`}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <View
          className="flex-1 p-4"
          accessible
          accessibilityRole="image"
          accessibilityLabel={baseNameOf(name)}
        >
          {isSvg ? (
            svg !== null && <SvgXml xml={svg} width="100%" height="100%" />
          ) : (
            <Image
              source={{ uri }}
              resizeMode="contain"
              className="size-full"
              onError={() => setFailedUri(uri)}
            />
          )}
        </View>
      )}
    </View>
  );
}
