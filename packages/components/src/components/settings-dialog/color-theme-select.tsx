import {
  COLOR_THEMES,
  type ColorPalette,
} from "@lunarscribe/components/themes/color-themes";
import {
  type ColorThemeMode,
  type ImportedColorTheme,
  resolveColorTheme,
} from "@lunarscribe/components/themes/imported-color-themes";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@lunarscribe/components/ui/select";
import type { CSSProperties } from "react";

/** Stands for the colors written in globals.css rather than a color theme. */
const DEFAULT_COLOR_THEME = "default";

/** The name of each theme's color theme setting. */
export const COLOR_THEME_LABELS = {
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

type SwatchStyle = CSSProperties & { "--swatch": string };

/** The five colors of a color theme, each painted through a custom property so the value stays dynamic. */
export function ColorThemeSwatches({ palette }: { palette: ColorPalette }) {
  return SWATCH_TOKENS.map((token) => {
    const style: SwatchStyle = { "--swatch": palette[token] };

    return (
      <span
        key={token}
        className="ring-foreground/15 size-3.5 shrink-0 rounded-xs bg-(--swatch) ring-1"
        style={style}
      />
    );
  });
}

/**
 * Picks the color theme for one theme: the built-in catalog, then the imported
 * color themes that have colors for this theme, each with its five colors.
 */
export function ColorThemeSelect({
  theme,
  colorTheme,
  importedColorThemes,
  onColorThemeChange,
}: {
  theme: ColorThemeMode;
  colorTheme: string | null;
  importedColorThemes: ReadonlyArray<ImportedColorTheme>;
  onColorThemeChange: (colorTheme: string | null) => void;
}) {
  const imported = importedColorThemes.filter(
    (candidate) => candidate[theme] !== undefined,
  );

  const selected = resolveColorTheme(colorTheme, imported);

  const value =
    selected?.[theme] === undefined ? DEFAULT_COLOR_THEME : selected.id;

  const items = {
    [DEFAULT_COLOR_THEME]: "Default",
    ...Object.fromEntries(
      [...COLOR_THEMES, ...imported].map((candidate) => [
        candidate.id,
        candidate.label,
      ]),
    ),
  };

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) =>
        onColorThemeChange(next === DEFAULT_COLOR_THEME ? null : next)
      }
    >
      <SelectTrigger
        className="w-56 justify-between"
        aria-label={COLOR_THEME_LABELS[theme]}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value={DEFAULT_COLOR_THEME}>Default</SelectItem>
        {imported.length > 0 && (
          <SelectGroup>
            <SelectLabel>Imported</SelectLabel>
            {imported.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate[theme] && (
                  <ColorThemeSwatches palette={candidate[theme]} />
                )}
                <span>{candidate.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        <SelectGroup>
          <SelectLabel>Built in</SelectLabel>
          {COLOR_THEMES.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              <ColorThemeSwatches palette={candidate[theme]} />
              <span>{candidate.label}</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
