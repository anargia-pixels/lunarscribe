import { findColorTheme } from "@lunarscribe/components/themes/color-themes";

import { useAppearanceStore } from "@/stores/appearance-store";

/** The palette of the current theme's color theme, or null for the colors in global.css. */
export function useColorPalette() {
  return useAppearanceStore(({ theme, lightColorTheme, darkColorTheme }) => {
    const colorTheme = theme === "dark" ? darkColorTheme : lightColorTheme;

    return findColorTheme(colorTheme)?.[theme] ?? null;
  });
}
