import * as SplashScreen from "expo-splash-screen";
import { Typography } from "heroui-native";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { useEditorHostStore } from "@/stores/editor-host-store";

import icon from "../../../../assets/icons/512x512.png";

// Keep the native splash until the app splash covers the screen.
void SplashScreen.preventAutoHideAsync();

// Stop waiting for the markdown editor after this, so a slow page never blocks the app.
const MAX_SPLASH_MS = 2000;

const StyledAnimatedView = withUniwind(Animated.View);

/**
 * Continues the native splash, which shows only the icon, with the wordmark in the
 * logo font. It stays until the markdown editor loads, so the first file opens at once.
 */
export function AppSplash() {
  const isMarkdownLoaded = useEditorHostStore(
    (state) => state.isLoaded.markdown,
  );

  const [hasTimedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), MAX_SPLASH_MS);

    return () => clearTimeout(timeout);
  }, []);

  if (isMarkdownLoaded || hasTimedOut) {
    return null;
  }

  // The icon has the native splash's size and position, so only the wordmark appears.
  return (
    <StyledAnimatedView
      exiting={FadeOut}
      className="bg-background absolute inset-0 items-center justify-center"
      onLayout={() => SplashScreen.hide()}
    >
      <Image
        source={icon}
        accessibilityIgnoresInvertColors
        className="size-32"
      />
      <View className="absolute top-1/2 mt-20">
        <Typography.Heading type="h3" className="font-logo text-accent">
          Lunarscribe
        </Typography.Heading>
      </View>
    </StyledAnimatedView>
  );
}
