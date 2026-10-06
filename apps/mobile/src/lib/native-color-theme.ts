import type { ColorPalette } from "@lunarscribe/components/themes/color-themes";
import { Uniwind } from "uniwind";

import type { Theme } from "@/lib/editor-types";

/**
 * HeroUI Native's tokens, each filled from the color theme token that matches it in
 * the default palettes (global.css here, globals.css on desktop). Success and
 * warning have no color theme token, so they keep the colors in global.css.
 */
const NATIVE_TOKENS = {
  "--background": "background",
  "--foreground": "foreground",
  "--surface": "card",
  "--surface-foreground": "card-foreground",
  "--surface-secondary": "muted",
  "--surface-secondary-foreground": "foreground",
  "--surface-tertiary": "secondary",
  "--surface-tertiary-foreground": "secondary-foreground",
  "--overlay": "popover",
  "--overlay-foreground": "popover-foreground",
  "--muted": "muted-foreground",
  "--default": "secondary",
  "--default-foreground": "secondary-foreground",
  "--accent": "primary",
  "--accent-foreground": "primary-foreground",
  "--field-background": "card",
  "--field-foreground": "card-foreground",
  "--field-placeholder": "muted-foreground",
  "--danger": "destructive",
  "--danger-foreground": "destructive-foreground",
  "--segment": "card",
  "--segment-foreground": "card-foreground",
  "--border": "border",
  "--separator": "input",
  "--focus": "ring",
  "--link": "primary",
} as const satisfies Record<string, keyof ColorPalette>;

/** Each theme's colors from global.css, read before a color theme first replaces them. */
const defaultColors: Partial<Record<Theme, Record<string, string | number>>> =
  {};

/**
 * Applies the palette to the native UI of the current theme. Without a palette,
 * the colors from global.css apply again. Call it after `Uniwind.setTheme(theme)`,
 * because Uniwind reads the default colors from the current theme.
 */
export function applyNativeColorTheme(
  theme: Theme,
  palette: ColorPalette | null,
) {
  defaultColors[theme] ??= Object.fromEntries(
    Object.keys(NATIVE_TOKENS).flatMap((name) => {
      const value = Uniwind.getCSSVariable(name);

      return value === undefined ? [] : [[name, value]];
    }),
  );

  const variables = palette
    ? Object.fromEntries(
        Object.entries(NATIVE_TOKENS).map(([name, token]) => [
          name,
          palette[token],
        ]),
      )
    : defaultColors[theme];

  Uniwind.updateCSSVariables(theme, variables);
}
