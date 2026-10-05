import "@/global.css";
import { PixelifySans_400Regular } from "@expo-google-fonts/pixelify-sans";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { RobotoMono_400Regular } from "@expo-google-fonts/roboto-mono";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { setBackgroundColorAsync } from "expo-system-ui";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { useLayoutEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaListener } from "react-native-safe-area-context";
import { Uniwind, withUniwind } from "uniwind";

import { useSync } from "@/components/use-sync";
import { useAppearanceStore } from "@/stores/appearance-store";

const StyledGestureHandlerRootView = withUniwind(GestureHandlerRootView);

const StyledSafeAreaListener = withUniwind(SafeAreaListener);

const SCREEN_OPTIONS = { headerShown: false };

/** App shell shared by every screen: fonts, theme, and HeroUI's providers. */
export default function RootLayout() {
  const theme = useAppearanceStore((state) => state.theme);
  const background = useThemeColor("background");

  useSync();

  const [hasLoadedFonts] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    RobotoMono_400Regular,
    PixelifySans_400Regular,
  });

  useLayoutEffect(() => {
    Uniwind.setTheme(theme);
    setStatusBarStyle(theme === "dark" ? "light" : "dark");
  }, [theme]);

  // Screens, and the root view behind them during transitions, use the app's
  // background instead of the navigation and system defaults, so nothing flashes.
  const navigationTheme = useMemo(() => {
    const base = theme === "dark" ? DarkTheme : DefaultTheme;

    return {
      ...base,
      colors: { ...base.colors, background, card: background },
    };
  }, [theme, background]);

  useLayoutEffect(() => {
    setBackgroundColorAsync(background);
  }, [background]);

  if (!hasLoadedFonts) {
    return null;
  }

  return (
    <StyledGestureHandlerRootView className="flex-1">
      {/* Safe-area insets for Uniwind's pt-safe and pb-safe */}
      <StyledSafeAreaListener
        className="flex-1"
        onChange={({ insets }) => Uniwind.updateInsets(insets)}
      >
        <HeroUINativeProvider>
          <ThemeProvider value={navigationTheme}>
            <Stack screenOptions={SCREEN_OPTIONS} />
          </ThemeProvider>
        </HeroUINativeProvider>
      </StyledSafeAreaListener>
    </StyledGestureHandlerRootView>
  );
}
