import {
  COLOR_THEMES,
  findColorTheme,
  type ColorPalette,
} from "@lunarscribe/components/themes/color-themes";
import { Button } from "@lunarscribe/components/ui/button";
import { Label } from "@lunarscribe/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lunarscribe/components/ui/select";
import { Switch } from "@lunarscribe/components/ui/switch";
import { RotateCcw } from "lucide-react";
import type { CSSProperties } from "react";

import { FontSettings } from "@/components/settings-dialog/font-settings";
import { type Theme, useAppearanceStore } from "@/stores/appearance-store";
import {
  type ZoomPercent,
  useZoomStore,
  ZOOM_PERCENTS,
} from "@/stores/zoom-store";

/** Stands for the colors written in globals.css rather than a color theme. */
const DEFAULT_COLOR_THEME = "default";

const LABELS = {
  light: "Light theme",
  dark: "Dark theme",
} as const;

const COLOR_THEME_ITEMS = {
  [DEFAULT_COLOR_THEME]: "Default",
  ...Object.fromEntries(
    COLOR_THEMES.map((colorTheme) => [colorTheme.id, colorTheme.label]),
  ),
};

/** The five colors a color theme shows beside its name. */
const SWATCH_TOKENS = [
  "background",
  "foreground",
  "accent",
  "primary",
  "popover",
] as const;

type SwatchStyle = CSSProperties & { "--swatch": string };

/** Picks the color theme for one theme; every color theme in the dropdown with its five colors. */
function ColorThemeSelect({
  theme,
  colorTheme,
  onColorThemeChange,
}: {
  theme: Theme;
  colorTheme: string | null;
  onColorThemeChange: (colorTheme: string | null) => void;
}) {
  const selected = findColorTheme(colorTheme);
  const value = selected === undefined ? DEFAULT_COLOR_THEME : selected.id;

  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-sm">{LABELS[theme]}</span>
      <Select
        items={COLOR_THEME_ITEMS}
        value={value}
        onValueChange={(next) =>
          onColorThemeChange(next === DEFAULT_COLOR_THEME ? null : next)
        }
      >
        <SelectTrigger
          className="w-64 justify-between"
          aria-label={LABELS[theme]}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value={DEFAULT_COLOR_THEME}>Default</SelectItem>
          {COLOR_THEMES.map((colorTheme) => (
            <SelectItem key={colorTheme.id} value={colorTheme.id}>
              <ColorThemeSwatches palette={colorTheme[theme]} />
              <span>{colorTheme.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const ZOOM_ITEMS = ZOOM_PERCENTS.map((percent) => ({
  value: percent,
  label: `${percent}%`,
}));

/** Picks the window zoom from the same steps the zoom shortcuts move through. */
function ZoomSelect() {
  const percent = useZoomStore((state) => state.percent);
  const setPercent = useZoomStore((state) => state.setPercent);

  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-sm">Zoom</span>
      <Select<ZoomPercent>
        items={ZOOM_ITEMS}
        value={percent}
        onValueChange={(next) => {
          if (next !== null) {
            setPercent(next);
          }
        }}
      >
        <SelectTrigger className="w-64 justify-between" aria-label="Zoom">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {ZOOM_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The five colors of a color theme, each painted through a custom property so the value stays dynamic. */
function ColorThemeSwatches({ palette }: { palette: ColorPalette }) {
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

/** Hides the toolbar; the editor context menu keeps every action. */
function EditorToolbarSwitch() {
  const showEditorToolbar = useAppearanceStore(
    (state) => state.showEditorToolbar,
  );

  const setShowEditorToolbar = useAppearanceStore(
    (state) => state.setShowEditorToolbar,
  );

  return (
    <div className="flex items-center justify-between gap-6">
      <Label htmlFor="show-editor-toolbar">Show toolbar</Label>
      <Switch
        id="show-editor-toolbar"
        checked={showEditorToolbar}
        onCheckedChange={setShowEditorToolbar}
      />
    </div>
  );
}

/** Appearances pane: color themes, zoom, and separate UI, buffer, and code fonts. */
export function AppearancePane() {
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

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Appearances</h2>
        <p className="text-muted-foreground text-sm">
          A color theme restyles every color in the app. Each theme picks its
          own.
        </p>
      </header>
      <div className="flex max-w-lg flex-col gap-4">
        <ColorThemeSelect
          theme="light"
          colorTheme={lightColorTheme}
          onColorThemeChange={setLightColorTheme}
        />
        <ColorThemeSelect
          theme="dark"
          colorTheme={darkColorTheme}
          onColorThemeChange={setDarkColorTheme}
        />
      </div>
      <Button
        variant="outline"
        className="self-start"
        disabled={lightColorTheme === null && darkColorTheme === null}
        onClick={resetColorThemes}
      >
        <RotateCcw />
        Reset to defaults
      </Button>
      <FontSettings />
      <div className="flex max-w-lg flex-col gap-4">
        <ZoomSelect />
        <EditorToolbarSwitch />
      </div>
    </div>
  );
}
