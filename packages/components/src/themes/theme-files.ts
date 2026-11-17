/**
 * Color themes from a file the user drops or pastes: a T3 skin, a VS Code
 * theme file, or a whole VS Code extension (`.vsix`).
 */

import { type ImportedColorTheme, slugify } from "./imported-color-themes";
import { colorThemesFromVsix } from "./open-vsx";
import { isT3Skin, parseT3Skin } from "./t3-skins";
import { parseThemeJson } from "./theme-json";
import {
  isVsCodeTheme,
  parseVsCodeTheme,
  vsCodeColorThemes,
} from "./vscode-themes";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** A file name such as `one-dark-pro.json` as a label: "One Dark Pro". */
function labelFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "").trim();

  return stem
    .split(/[-_.\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Converts pasted or uploaded theme JSON. */
export function colorThemesFromText(
  text: string,
  fileName = "Imported theme",
): ImportedColorTheme[] {
  const value = parseThemeJson(text);

  if (isT3Skin(value)) {
    return [parseT3Skin(value)];
  }

  if (isVsCodeTheme(value)) {
    const label = labelFromFileName(fileName) || "Imported theme";

    return vsCodeColorThemes([parseVsCodeTheme(value, label)], "file");
  }

  throw new Error("That is neither a T3 skin nor a VS Code color theme.");
}

/** Converts a dropped or chosen file: theme JSON, or a `.vsix` with its themes. */
export async function colorThemesFromFile(
  file: File,
): Promise<ImportedColorTheme[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That file is too large to be a color theme.");
  }

  if (/\.vsix$/i.test(file.name)) {
    const bytes = new Uint8Array(await file.arrayBuffer());

    return colorThemesFromVsix(bytes, `file.${slugify(file.name)}`);
  }

  return colorThemesFromText(await file.text(), file.name);
}
