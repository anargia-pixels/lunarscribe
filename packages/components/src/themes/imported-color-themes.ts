/**
 * Color themes the user imports from T3 Skins, Open VSX or a theme file. Every
 * source is converted into the same tokens as the built-in catalog when it is
 * imported, so applying one works exactly like applying a built-in color theme.
 */

import {
  contrastRatio,
  mix,
  parseColor,
  readableOn,
  toHex,
  type Rgba,
} from "./color";
import {
  type ColorPalette,
  type ColorToken,
  findColorTheme,
} from "./color-themes";

// Types

export type ColorThemeMode = "light" | "dark";

export type ImportedColorThemeSource = "t3-skins" | "vscode";

export type ImportedColorTheme = {
  id: string;
  label: string;
  source: ImportedColorThemeSource;
  /** At least one of `light` and `dark` is set. */
  light?: ColorPalette;
  dark?: ColorPalette;
  /** Stylesheet from a T3 skin; sanitized again every time it is applied. */
  css?: string;
  /** Image a T3 skin's CSS reads through `var(--theme-background-image)`. */
  backgroundImage?: string;
};

/** What the settings and the theme provider need from a built-in or an imported color theme. */
type AnyColorTheme = {
  id: string;
  label: string;
  light?: ColorPalette;
  dark?: ColorPalette;
  css?: string;
  backgroundImage?: string;
};

/** The colors a source defines; every missing token is derived from these. */
export type KnownColors = Partial<Record<ColorToken, Rgba | null>>;

// Lookup

/** A built-in color theme by id, else an imported one; undefined when neither has the id. */
export function resolveColorTheme(
  id: string | null,
  imported: ReadonlyArray<ImportedColorTheme>,
): AnyColorTheme | undefined {
  if (id === null) {
    return undefined;
  }

  return findColorTheme(id) ?? imported.find((theme) => theme.id === id);
}

/** Turns a display name into an id part: lowercase words joined by dashes. */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "theme"
  );
}

// Palette

const DESTRUCTIVE = {
  light: parseColor("#b54a35"),
  dark: parseColor("#f38ba8"),
} as const;

/**
 * Fills every token from the colors a source knows. `background` is required.
 * Text colors that would be hard to read on their surface fall back to one
 * that is, so a sparse or low-contrast source still yields a usable palette.
 */
export function completePalette(
  known: KnownColors & { background: Rgba },
  mode: ColorThemeMode,
): ColorPalette {
  const pick = (token: ColorToken, fallback: Rgba) => known[token] ?? fallback;
  const has = (token: ColorToken) => known[token] ?? null;

  const background = known.background;
  const foreground = readableOn(background, [has("foreground")]);

  const primary =
    known.primary && contrastRatio(known.primary, background) >= 1.1
      ? known.primary
      : foreground;

  const card = pick("card", mix(background, foreground, 0.03));
  const popover = pick("popover", card);
  const secondary = pick("secondary", mix(background, foreground, 0.08));
  const muted = pick("muted", mix(background, foreground, 0.06));
  const accent = pick("accent", mix(background, primary, 0.18));
  const destructive = pick("destructive", DESTRUCTIVE[mode] ?? foreground);
  const border = pick("border", mix(background, foreground, 0.14));
  const input = pick("input", border);
  const ring = pick("ring", primary);

  // Softer than the text where contrast allows, else the text color itself.
  const mutedForeground = readableOn(
    background,
    [
      has("muted-foreground"),
      mix(foreground, background, 0.35),
      mix(foreground, background, 0.2),
      foreground,
    ],
    3,
  );

  const primaryForeground = readableOn(primary, [has("primary-foreground")]);

  const accentForeground = readableOn(accent, [
    has("accent-foreground"),
    foreground,
  ]);

  // Headings sit on the background; syntax colors on code blocks, which use `muted`.
  const heading = (token: ColorToken, ...fallbacks: Array<Rgba | null>) =>
    readableOn(background, [has(token), ...fallbacks, foreground], 3);

  const heading1 = heading("heading-1", primary);
  const heading2 = heading("heading-2", has("syntax-type"), primary);
  const heading3 = heading("heading-3", has("syntax-string"), primary);

  const syntax = (token: ColorToken, ...fallbacks: Array<Rgba | null>) =>
    readableOn(muted, [has(token), ...fallbacks, foreground], 3);

  const syntaxString = syntax("syntax-string", heading3);
  const syntaxNumber = syntax("syntax-number", heading2);

  const sidebar = pick("sidebar", background);
  const sidebarPrimary = pick("sidebar-primary", primary);
  const sidebarAccent = pick("sidebar-accent", accent);

  const palette: Record<ColorToken, Rgba> = {
    background,
    foreground,
    card,
    "card-foreground": readableOn(card, [has("card-foreground"), foreground]),
    popover,
    "popover-foreground": readableOn(popover, [
      has("popover-foreground"),
      foreground,
    ]),
    primary,
    "primary-foreground": primaryForeground,
    secondary,
    "secondary-foreground": readableOn(secondary, [
      has("secondary-foreground"),
      foreground,
    ]),
    muted,
    "muted-foreground": mutedForeground,
    accent,
    "accent-foreground": accentForeground,
    destructive,
    "destructive-foreground": readableOn(destructive, [
      has("destructive-foreground"),
    ]),
    border,
    input,
    ring,
    "heading-1": heading1,
    "heading-2": heading2,
    "heading-3": heading3,
    "syntax-comment": syntax("syntax-comment", mutedForeground),
    "syntax-keyword": syntax("syntax-keyword", primary),
    "syntax-string": syntaxString,
    "syntax-number": syntaxNumber,
    "syntax-function": syntax("syntax-function", heading1),
    "syntax-type": syntax("syntax-type", heading2),
    "syntax-operator": syntax("syntax-operator", foreground),
    "chart-1": pick("chart-1", primary),
    "chart-2": pick("chart-2", heading1),
    "chart-3": pick("chart-3", heading2),
    "chart-4": pick("chart-4", heading3),
    "chart-5": pick("chart-5", syntaxNumber),
    sidebar,
    "sidebar-foreground": readableOn(sidebar, [
      has("sidebar-foreground"),
      foreground,
    ]),
    "sidebar-primary": sidebarPrimary,
    "sidebar-primary-foreground": readableOn(sidebarPrimary, [
      has("sidebar-primary-foreground"),
      primaryForeground,
    ]),
    "sidebar-accent": sidebarAccent,
    "sidebar-accent-foreground": readableOn(sidebarAccent, [
      has("sidebar-accent-foreground"),
      accentForeground,
      foreground,
    ]),
    "sidebar-border": pick("sidebar-border", border),
    "sidebar-ring": pick("sidebar-ring", ring),
  };

  // SAFETY: `palette` names every token, and each keeps its key while its color becomes hex.
  return Object.fromEntries(
    Object.entries(palette).map(([token, color]) => [token, toHex(color)]),
  ) as ColorPalette;
}
