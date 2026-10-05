import { findColorTheme } from "@lunarscribe/components/themes/color-themes";

import { useAppearanceStore } from "@/stores/appearance-store";

/** The palette of the current theme's color theme, or null for the colors in global.css. */
export function useColorPalette() {
  const theme = useAppearanceStore((state) => state.theme);

  const colorTheme = useAppearanceStore((state) =>
    state.theme === "dark" ? state.darkColorTheme : state.lightColorTheme,
  );

  return findColorTheme(colorTheme)?.[theme] ?? null;
}
