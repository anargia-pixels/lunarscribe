import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  COLOR_THEMES,
  findColorTheme,
  type ColorPalette,
} from "@lunarscribe/components/themes/color-themes";
import { Select, Typography } from "heroui-native";
import { View } from "react-native";
import { ScopedVariables } from "uniwind";

import type { Theme } from "@/lib/editor-types";

/** Stands for the colors written in global.css rather than a color theme. */
const DEFAULT_COLOR_THEME = { value: "default", label: "Default" };

const LABELS = {
  light: "Light theme",
  dark: "Dark theme",
} as const;

/** The five colors a color theme shows beside its name. */
const SWATCH_TOKENS = [
  "background",
  "foreground",
  "accent",
  "primary",
  "popover",
] as const;

/** The five colors of a color theme, each painted through a scoped variable so the value stays dynamic. */
function ColorThemeSwatches({ palette }: { palette: ColorPalette }) {
  return (
    <View className="flex-row gap-1">
      {SWATCH_TOKENS.map((token) => (
        <ScopedVariables key={token} variables={{ "--swatch": palette[token] }}>
          <View className="border-foreground/15 size-3.5 rounded-sm border bg-(--swatch)" />
        </ScopedVariables>
      ))}
    </View>
  );
}

/** Picks the color theme for one theme; the sheet lists every color theme with its five colors. */
export function ColorThemeSelect({
  theme,
  colorTheme,
  onColorThemeChange,
}: {
  theme: Theme;
  colorTheme: string | null;
  onColorThemeChange: (colorTheme: string | null) => void;
}) {
  const selected = findColorTheme(colorTheme);

  const value = selected
    ? { value: selected.id, label: selected.label }
    : DEFAULT_COLOR_THEME;

  return (
    <View className="flex-row items-center justify-between gap-4">
      <Typography type="body-sm">{LABELS[theme]}</Typography>
      <Select
        presentation="bottom-sheet"
        value={value}
        onValueChange={(next) => {
          if (next) {
            onColorThemeChange(
              next.value === DEFAULT_COLOR_THEME.value ? null : next.value,
            );
          }
        }}
      >
        <Select.Trigger className="w-56" accessibilityLabel={LABELS[theme]}>
          <Select.Value placeholder={DEFAULT_COLOR_THEME.label} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Overlay />
          {/* A fixed height, so the long list scrolls inside the sheet */}
          <Select.Content
            presentation="bottom-sheet"
            snapPoints={["60%"]}
            enableOverDrag={false}
            enableDynamicSizing={false}
            contentContainerClassName="h-full"
          >
            <Select.ListLabel>{LABELS[theme]}</Select.ListLabel>
            <BottomSheetScrollView>
              <Select.Item {...DEFAULT_COLOR_THEME} />
              {COLOR_THEMES.map((colorTheme) => (
                <Select.Item
                  key={colorTheme.id}
                  value={colorTheme.id}
                  label={colorTheme.label}
                >
                  <View className="flex-1 flex-row items-center gap-3">
                    <ColorThemeSwatches palette={colorTheme[theme]} />
                    <Select.ItemLabel />
                  </View>
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </BottomSheetScrollView>
          </Select.Content>
        </Select.Portal>
      </Select>
    </View>
  );
}
