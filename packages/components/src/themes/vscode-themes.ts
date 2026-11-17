/**
 * VS Code color themes. Workbench colors (`colors`) give the interface tokens
 * and TextMate rules (`tokenColors`) give the heading and syntax tokens. The
 * workbench mapping follows T3 Code's importer (MIT, https://github.com/pingdotgg/t3code).
 */

import {
  contrastRatio,
  flattenOver,
  isDarkColor,
  parseColor,
  type Rgba,
} from "./color";
import type { ColorPalette } from "./color-themes";
import {
  type ColorThemeMode,
  completePalette,
  type ImportedColorTheme,
  type KnownColors,
  slugify,
} from "./imported-color-themes";
import {
  type JsonObject,
  type JsonValue,
  jsonList,
  jsonObject,
  jsonText,
} from "./theme-json";

// Types

/** One converted theme file, before light and dark files of a family are paired. */
export type VsCodeTheme = {
  label: string;
  mode: ColorThemeMode;
  palette: ColorPalette;
};

// Detection

/** Whether parsed JSON is a VS Code theme: workbench colors with dotted keys, or TextMate rules. */
export function isVsCodeTheme(value: JsonValue): boolean {
  const theme = jsonObject(value);

  if (theme === null) {
    return false;
  }

  const colors = jsonObject(theme.colors);

  const hasWorkbenchColors =
    colors !== null && Object.keys(colors).some((key) => key.includes("."));

  return hasWorkbenchColors || Array.isArray(theme.tokenColors);
}

// TextMate rules

type TokenRule = { selectors: string[]; foreground: Rgba };

function tokenRules(theme: JsonObject): TokenRule[] {
  const rules: TokenRule[] = [];

  for (const entry of jsonList(theme.tokenColors)) {
    const rule = jsonObject(entry);
    const foreground = parseColor(jsonObject(rule?.settings)?.foreground);
    const scope = rule?.scope;

    if (foreground === null || scope === undefined) {
      continue;
    }

    const scopes = Array.isArray(scope) ? scope : [scope];

    const selectors = scopes
      .flatMap((item) => (jsonText(item) ?? "").split(","))
      .map((selector) => selector.trim())
      // Exclusions such as `source - comment` need a scope stack we do not have.
      .filter((selector) => selector.length > 0 && !/\s-\s/.test(selector));

    rules.push({ selectors, foreground });
  }

  return rules;
}

/** Whether a selector part such as `keyword` covers a scope such as `keyword.control`. */
function covers(part: string, scope: string): boolean {
  return scope === part || scope.startsWith(`${part}.`);
}

/**
 * The color TextMate would give the first scope that any rule matches. A plain
 * selector beats one that also names a parent scope, and longer selectors win,
 * as they would in VS Code. Later rules win ties.
 */
function scopeColor(rules: TokenRule[], scopes: string[]): Rgba | null {
  for (const scope of scopes) {
    let best: { score: number; color: Rgba } | null = null;

    for (const rule of rules) {
      for (const selector of rule.selectors) {
        const parts = selector.split(/\s+/);
        const part = parts.find((candidate) => covers(candidate, scope));

        if (part === undefined) {
          continue;
        }

        const score = (parts.length === 1 ? 1000 : 0) + part.length;

        if (best === null || score >= best.score) {
          best = { score, color: rule.foreground };
        }
      }
    }

    if (best !== null) {
      return best.color;
    }
  }

  return null;
}

// Conversion

function resolveMode(
  theme: JsonObject,
  background: Rgba,
  uiTheme?: string,
): ColorThemeMode {
  const type = (jsonText(theme.type) ?? uiTheme ?? "").toLowerCase();

  if (type === "light" || type === "hc-light" || type === "vs") {
    return "light";
  }

  if (type === "dark" || type === "hc-black" || type === "vs-dark") {
    return "dark";
  }

  return isDarkColor(background) ? "dark" : "light";
}

/** Converts one VS Code theme file. `uiTheme` is the extension manifest's `vs` or `vs-dark`. */
export function parseVsCodeTheme(
  value: JsonValue,
  fallbackLabel: string,
  uiTheme?: string,
): VsCodeTheme {
  const theme = jsonObject(value);
  const colors = jsonObject(theme?.colors) ?? {};

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const color = parseColor(colors[key]);

      if (color !== null) {
        return color;
      }
    }

    return null;
  };

  const rules = theme === null ? [] : tokenRules(theme);
  const defaultForeground = scopeColor(rules, ["source", "text"]);
  const canvas = pick("editor.background", "editorPane.background");

  if (theme === null || canvas === null) {
    throw new Error(
      'That VS Code theme has no "editor.background" color to build a color theme from.',
    );
  }

  const background = { ...canvas, a: 1 };

  // VS Code layers translucent colors over a surface; our tokens are opaque.
  const over = (surface: Rgba, ...keys: string[]) => {
    const color = pick(...keys);

    return color === null ? null : flattenOver(color, surface);
  };

  const standsApart = (color: Rgba | null) =>
    color !== null && contrastRatio(color, background) >= 1.1;

  const accent =
    [
      "focusBorder",
      "button.background",
      "textLink.foreground",
      "activityBarBadge.background",
      "progressBar.background",
      "badge.background",
    ]
      .map((key) => over(background, key))
      .find(standsApart) ?? null;

  const button = over(background, "button.background");
  const primary = standsApart(button) ? button : accent;

  const sidebar =
    over(background, "sideBar.background", "activityBar.background") ??
    background;

  const listSelection = over(
    background,
    "list.activeSelectionBackground",
    "list.hoverBackground",
  );

  const known: KnownColors = {
    foreground:
      over(background, "editor.foreground", "foreground") ?? defaultForeground,
    card: over(background, "editorWidget.background"),
    popover: over(
      background,
      "menu.background",
      "quickInput.background",
      "dropdown.background",
    ),
    "popover-foreground": over(
      background,
      "menu.foreground",
      "quickInput.foreground",
    ),
    primary,
    "primary-foreground": primary === button ? pick("button.foreground") : null,
    secondary: over(background, "button.secondaryBackground"),
    "secondary-foreground": pick("button.secondaryForeground"),
    "muted-foreground": over(
      background,
      "descriptionForeground",
      "disabledForeground",
    ),
    accent: listSelection,
    "accent-foreground": pick("list.activeSelectionForeground"),
    destructive: over(background, "editorError.foreground", "errorForeground"),
    border: over(
      background,
      "panel.border",
      "editorGroup.border",
      "contrastBorder",
    ),
    input: over(background, "input.border", "input.background"),
    ring: accent,
    "heading-1": scopeColor(rules, [
      "heading.1.markdown",
      "markup.heading.1",
      "markup.heading",
      "entity.name.section",
    ]),
    "heading-2": scopeColor(rules, [
      "heading.2.markdown",
      "markup.heading.2",
      "markup.heading",
      "entity.name.section",
    ]),
    "heading-3": scopeColor(rules, [
      "heading.3.markdown",
      "markup.heading.3",
      "markup.heading",
      "entity.name.section",
    ]),
    "syntax-comment": scopeColor(rules, ["comment.line", "comment"]),
    "syntax-keyword": scopeColor(rules, [
      "keyword.control",
      "keyword",
      "storage.type",
    ]),
    "syntax-string": scopeColor(rules, ["string.quoted", "string"]),
    "syntax-number": scopeColor(rules, ["constant.numeric", "constant"]),
    "syntax-function": scopeColor(rules, [
      "entity.name.function",
      "support.function",
    ]),
    "syntax-type": scopeColor(rules, [
      "entity.name.type",
      "support.type",
      "entity.name.class",
    ]),
    "syntax-operator": scopeColor(rules, ["keyword.operator", "punctuation"]),
    sidebar,
    "sidebar-foreground": pick("sideBar.foreground"),
    "sidebar-accent": over(
      sidebar,
      "list.activeSelectionBackground",
      "list.hoverBackground",
    ),
    "sidebar-accent-foreground": pick("list.activeSelectionForeground"),
    "sidebar-border": over(sidebar, "sideBar.border"),
  };

  const mode = resolveMode(theme, background, uiTheme);

  const name =
    jsonText(theme.displayName) ?? jsonText(theme.name) ?? fallbackLabel;

  return {
    label: name.trim().slice(0, 48) || fallbackLabel,
    mode,
    palette: completePalette({ ...known, background }, mode),
  };
}

// Pairing

/** A label with "light" and "dark" removed, so a family's two files share one key. */
function familyLabel(label: string): string {
  return label
    .replace(/\b(?:light|dark)\b/gi, " ")
    .replace(/[\s:–—-]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turns converted files into color themes. A family with exactly one light and
 * one dark file, such as "GitHub Light" and "GitHub Dark", becomes one color
 * theme with both; every other file becomes a color theme of its own.
 */
export function vsCodeColorThemes(
  themes: ReadonlyArray<VsCodeTheme>,
  idPrefix: string,
): ImportedColorTheme[] {
  const families = new Map<string, VsCodeTheme[]>();

  for (const theme of themes) {
    const key = familyLabel(theme.label);
    const family = families.get(key) ?? [];

    family.push(theme);
    families.set(key, family);
  }

  const result: ImportedColorTheme[] = [];
  const usedIds = new Set<string>();

  // Two files can share a label; the later one gets a numbered id.
  const uniqueId = (label: string) => {
    const base = `vscode:${idPrefix}:${slugify(label)}`;
    let id = base;

    for (let suffix = 2; usedIds.has(id); suffix += 1) {
      id = `${base}-${suffix}`;
    }

    usedIds.add(id);

    return id;
  };

  for (const [key, family] of families) {
    const lights = family.filter((theme) => theme.mode === "light");
    const darks = family.filter((theme) => theme.mode === "dark");
    const [light] = lights;
    const [dark] = darks;

    if (
      light !== undefined &&
      dark !== undefined &&
      family.length === 2 &&
      key.length > 0 &&
      key !== light.label
    ) {
      result.push({
        id: uniqueId(key),
        label: key,
        source: "vscode",
        light: light.palette,
        dark: dark.palette,
      });

      continue;
    }

    for (const theme of family) {
      result.push({
        id: uniqueId(theme.label),
        label: theme.label,
        source: "vscode",
        [theme.mode]: theme.palette,
      });
    }
  }

  return result;
}
