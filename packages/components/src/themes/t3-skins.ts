/**
 * T3 Skins (https://www.t3skins.dev): theme files made for T3 Code. A skin
 * names about 60 color roles for the light or dark theme, may carry a variant
 * for the other one, and may ship a stylesheet. The roles map onto our tokens
 * the way T3 Code maps them onto its own shadcn tokens.
 */

import { parseColor, type Rgba } from "./color";
import {
  type ColorThemeMode,
  completePalette,
  type ImportedColorTheme,
  type KnownColors,
  slugify,
} from "./imported-color-themes";
import {
  fetchJson,
  type JsonObject,
  type JsonValue,
  jsonList,
  jsonObject,
  jsonText,
} from "./theme-json";

const T3_SKINS_URL = "https://www.t3skins.dev";

const MAX_LIST_BYTES = 1024 * 1024;

const MAX_SKIN_BYTES = 512 * 1024;

const MAX_CSS_LENGTH = 200_000;

// Types

/** One skin in the gallery. */
export type T3SkinSummary = {
  slug: string;
  name: string;
  description: string;
  author: string;
  modes: ColorThemeMode[];
  canvas: string;
  accent: string;
  thumbnailUrl: string;
  backgroundImage: string | null;
};

// Conversion

function parseMode(value: JsonValue | undefined): ColorThemeMode | null {
  const text = jsonText(value);

  return text === "light" || text === "dark" ? text : null;
}

/** Our tokens from one set of skin roles; null when the set has no canvas color. */
function paletteFromRoles(
  roles: JsonObject,
  seed: { canvas: Rgba | null; accent: Rgba | null },
  mode: ColorThemeMode,
) {
  const role = (name: string) => parseColor(roles[name]);
  const background = role("canvas") ?? seed.canvas;

  if (background === null) {
    return null;
  }

  const accent = role("accent") ?? seed.accent;

  const known: KnownColors = {
    foreground: role("text"),
    card: role("surface"),
    "card-foreground": role("text"),
    popover: role("surfaceOverlay"),
    "popover-foreground": role("text"),
    primary: role("messageAction") ?? accent,
    "primary-foreground":
      role("messageActionForeground") ?? role("accentForeground"),
    secondary: role("secondary"),
    "secondary-foreground": role("secondaryForeground"),
    muted: role("muted"),
    "muted-foreground": role("mutedForeground") ?? role("textMuted"),
    accent: role("accentSurface"),
    "accent-foreground": role("accentSurfaceForeground"),
    destructive: role("error"),
    border: role("border"),
    input: role("input"),
    ring: role("focus") ?? accent,
    "heading-1": accent,
    "heading-2": role("warning"),
    "heading-3": role("update"),
    "syntax-comment": role("textMuted"),
    "syntax-keyword": accent,
    "syntax-string": role("update"),
    "syntax-number": role("warning"),
    "syntax-function": role("messageAction"),
    "syntax-type": role("accentSurfaceForeground"),
    "syntax-operator": role("codeForeground"),
    sidebar: role("sidebar"),
    "sidebar-foreground": role("sidebarForeground"),
    "sidebar-primary": accent,
    "sidebar-primary-foreground": role("accentForeground"),
    "sidebar-accent": role("sidebarRowSelected") ?? role("sidebarRowActive"),
    "sidebar-accent-foreground": role("sidebarForeground"),
    "sidebar-border": role("sidebarBorder"),
    "sidebar-ring": role("focus") ?? accent,
  };

  return completePalette({ ...known, background }, mode);
}

/** Whether parsed JSON looks like a T3 skin rather than a VS Code theme. */
export function isT3Skin(value: JsonValue): boolean {
  const skin = jsonObject(value);

  return (
    skin !== null && skin.version === 1 && parseMode(skin.appearance) !== null
  );
}

/**
 * Converts a T3 skin. `slug` names a skin from the gallery; a file has none,
 * so its id comes from its name. A background image is only kept from T3 Skins.
 */
export function parseT3Skin(
  value: JsonValue,
  slug?: string,
  backgroundImage?: string | null,
): ImportedColorTheme {
  const skin = jsonObject(value);
  const appearance = parseMode(skin?.appearance);
  const name = jsonText(skin?.name)?.trim();

  if (skin === null || skin.version !== 1 || appearance === null || !name) {
    throw new Error(
      "That is not a T3 skin: it needs a version, a name and an appearance.",
    );
  }

  const seed = {
    canvas: parseColor(skin.canvas),
    accent: parseColor(skin.accent),
  };

  const palettes: Partial<
    Record<ColorThemeMode, ReturnType<typeof paletteFromRoles>>
  > = {
    [appearance]: paletteFromRoles(
      jsonObject(skin.colors) ?? {},
      seed,
      appearance,
    ),
  };

  const variants = jsonObject(skin.variants) ?? {};

  for (const mode of ["light", "dark"] as const) {
    const roles = jsonObject(variants[mode]);

    if (mode !== appearance && roles !== null) {
      // A variant's seed colors belong to the other theme, so it brings its own canvas.
      palettes[mode] = paletteFromRoles(
        roles,
        { canvas: null, accent: null },
        mode,
      );
    }
  }

  const light = palettes.light ?? undefined;
  const dark = palettes.dark ?? undefined;

  if (light === undefined && dark === undefined) {
    throw new Error(
      "That T3 skin has no canvas color to build a color theme from.",
    );
  }

  const css = jsonText(skin.css) ?? "";
  const label = name.slice(0, 48);

  // The address goes into a CSS url(), so it may not hold quotes, spaces or escapes.
  const image =
    backgroundImage?.startsWith(`${T3_SKINS_URL}/`) === true &&
    !/["'\\\s()]/.test(backgroundImage)
      ? backgroundImage
      : undefined;

  return {
    id: `t3-skins:${slug ?? slugify(label)}`,
    label,
    source: "t3-skins",
    light,
    dark,
    css: css.length > 0 && css.length <= MAX_CSS_LENGTH ? css : undefined,
    backgroundImage: image,
  };
}

// Gallery

function parseSummary(value: JsonValue): T3SkinSummary | null {
  const skin = jsonObject(value);
  const slug = jsonText(skin?.slug);
  const name = jsonText(skin?.name);

  if (
    skin === null ||
    slug === null ||
    name === null ||
    !/^[a-z0-9-]+$/.test(slug)
  ) {
    return null;
  }

  const modes = jsonList(skin.modes)
    .map(parseMode)
    .filter((mode): mode is ColorThemeMode => mode !== null);

  return {
    slug,
    name,
    description: jsonText(skin.description) ?? "",
    author: jsonText(skin.authorName) ?? "",
    modes,
    canvas: jsonText(skin.canvas) ?? "",
    accent: jsonText(skin.accent) ?? "",
    thumbnailUrl: `${T3_SKINS_URL}/skins/${slug}/thumbnail`,
    backgroundImage: jsonText(skin.backgroundImage),
  };
}

/** The gallery's skins, most popular first, narrowed by `query` when it is not empty. */
export async function listT3Skins(
  query: string,
  signal?: AbortSignal,
): Promise<T3SkinSummary[]> {
  const params = new URLSearchParams({ perPage: "100", sort: "popular" });

  if (query.trim().length > 0) {
    params.set("q", query.trim());
  }

  const response = await fetchJson(
    `${T3_SKINS_URL}/api/skins?${params}`,
    MAX_LIST_BYTES,
    signal,
  );

  return jsonList(jsonObject(response)?.skins)
    .map(parseSummary)
    .filter((skin): skin is T3SkinSummary => skin !== null);
}

/** Downloads one skin from the gallery and converts it. */
export async function fetchT3Skin(
  skin: T3SkinSummary,
  signal?: AbortSignal,
): Promise<ImportedColorTheme> {
  const value = await fetchJson(
    `${T3_SKINS_URL}/skins/${skin.slug}/skin.json`,
    MAX_SKIN_BYTES,
    signal,
  );

  return parseT3Skin(value, skin.slug, skin.backgroundImage);
}
