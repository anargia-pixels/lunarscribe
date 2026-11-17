/**
 * VS Code theme extensions from Open VSX (https://open-vsx.org). Open VSX only
 * serves whole extensions, so the `.vsix` is downloaded and its theme files
 * are read from the zip. Size limits keep a hostile archive from exhausting memory.
 */

import { unzipSync } from "fflate";

import type { ImportedColorTheme } from "./imported-color-themes";
import {
  fetchJson,
  type JsonObject,
  type JsonValue,
  jsonList,
  jsonObject,
  jsonText,
  parseThemeJson,
} from "./theme-json";
import {
  parseVsCodeTheme,
  type VsCodeTheme,
  vsCodeColorThemes,
} from "./vscode-themes";

const OPEN_VSX_URL = "https://open-vsx.org";

const MAX_SEARCH_BYTES = 1024 * 1024;

const MAX_VSIX_BYTES = 20 * 1024 * 1024;

const MAX_THEME_FILE_BYTES = 1024 * 1024;

const MAX_ZIP_ENTRIES = 5000;

const MAX_THEMES_PER_EXTENSION = 40;

const MAX_INCLUDE_DEPTH = 8;

// Types

export type OpenVsxExtension = {
  namespace: string;
  name: string;
  displayName: string;
  description: string;
  downloadCount: number;
  iconUrl: string | null;
  downloadUrl: string;
};

// Search

/** Only Open VSX's own addresses are fetched, whatever a search result names. */
function openVsxUrl(value: JsonValue | undefined): string | null {
  const text = jsonText(value);

  return text?.startsWith(`${OPEN_VSX_URL}/`) === true ? text : null;
}

function parseExtension(value: JsonValue): OpenVsxExtension | null {
  const extension = jsonObject(value);
  const files = jsonObject(extension?.files);
  const namespace = jsonText(extension?.namespace);
  const name = jsonText(extension?.name);
  const downloadUrl = openVsxUrl(files?.download);

  if (namespace === null || name === null || downloadUrl === null) {
    return null;
  }

  return {
    namespace,
    name,
    displayName: jsonText(extension?.displayName) ?? name,
    description: jsonText(extension?.description) ?? "",
    downloadCount: Number(extension?.downloadCount) || 0,
    iconUrl: openVsxUrl(files?.icon),
    downloadUrl,
  };
}

/** Theme extensions matching `query`, or the most downloaded ones when it is empty. */
export async function searchOpenVsxThemes(
  query: string,
  signal?: AbortSignal,
): Promise<OpenVsxExtension[]> {
  const trimmed = query.trim();

  const params = new URLSearchParams({
    query: trimmed,
    category: "Themes",
    size: "30",
    sortBy: trimmed.length > 0 ? "relevance" : "downloadCount",
    sortOrder: "desc",
  });

  const response = await fetchJson(
    `${OPEN_VSX_URL}/api/-/search?${params}`,
    MAX_SEARCH_BYTES,
    signal,
  );

  return jsonList(jsonObject(response)?.extensions)
    .map(parseExtension)
    .filter((extension): extension is OpenVsxExtension => extension !== null);
}

// Extension files

/** Joins a path from the manifest onto a folder; null when it leaves the extension. */
function resolvePath(folder: string, relative: string): string | null {
  const parts = folder.split("/");

  for (const part of relative.replaceAll("\\", "/").split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }

  return parts[0] === "extension" ? parts.join("/") : null;
}

type ExtensionFiles = Record<string, Uint8Array>;

function readJsonFile(files: ExtensionFiles, path: string): JsonObject {
  const bytes = files[path];

  if (bytes === undefined) {
    throw new Error(`The extension is missing ${path}.`);
  }

  return jsonObject(parseThemeJson(new TextDecoder().decode(bytes))) ?? {};
}

/** A theme file with the files it `include`s merged underneath, as VS Code loads it. */
function readThemeFile(
  files: ExtensionFiles,
  path: string,
  depth = 0,
): JsonObject {
  const theme = readJsonFile(files, path);
  const include = jsonText(theme.include);
  const folder = path.slice(0, path.lastIndexOf("/"));
  const basePath = include === null ? null : resolvePath(folder, include);

  if (basePath === null || depth >= MAX_INCLUDE_DEPTH) {
    return theme;
  }

  const base = readThemeFile(files, basePath, depth + 1);

  return {
    ...base,
    ...theme,
    colors: { ...jsonObject(base.colors), ...jsonObject(theme.colors) },
    tokenColors: [
      ...jsonList(base.tokenColors),
      ...jsonList(theme.tokenColors),
    ],
  };
}

/** Every color theme in a `.vsix`; light and dark files of one family are paired. */
export function colorThemesFromVsix(
  bytes: Uint8Array,
  idPrefix: string,
): ImportedColorTheme[] {
  let entries = 0;

  const files = unzipSync(bytes, {
    filter: (file) => {
      entries += 1;

      if (entries > MAX_ZIP_ENTRIES) {
        throw new Error("That extension has too many files.");
      }

      return (
        file.name.startsWith("extension/") &&
        /\.jsonc?$/i.test(file.name) &&
        file.originalSize <= MAX_THEME_FILE_BYTES
      );
    },
  });

  const manifest = readJsonFile(files, "extension/package.json");
  const contributions = jsonList(jsonObject(manifest.contributes)?.themes);
  const themes: VsCodeTheme[] = [];

  for (const value of contributions.slice(0, MAX_THEMES_PER_EXTENSION)) {
    const contribution = jsonObject(value);
    const path = resolvePath("extension", jsonText(contribution?.path) ?? "");

    if (path === null) {
      continue;
    }

    const label =
      jsonText(contribution?.label) ?? path.slice(path.lastIndexOf("/") + 1);

    const uiTheme = jsonText(contribution?.uiTheme) ?? undefined;

    // A file that is missing or has no editor background is skipped; the others still import.
    try {
      const theme = readThemeFile(files, path);

      themes.push(parseVsCodeTheme({ ...theme, name: label }, label, uiTheme));
    } catch {
      continue;
    }
  }

  if (themes.length === 0) {
    throw new Error("That extension has no color themes Lunarscribe can read.");
  }

  return vsCodeColorThemes(themes, idPrefix);
}

/** Downloads an extension from Open VSX and reads its color themes. */
export async function loadOpenVsxColorThemes(
  extension: OpenVsxExtension,
  signal?: AbortSignal,
): Promise<ImportedColorTheme[]> {
  const response = await fetch(extension.downloadUrl, { signal });

  if (!response.ok) {
    throw new Error(`The download failed (${response.status}).`);
  }

  if (Number(response.headers.get("content-length")) > MAX_VSIX_BYTES) {
    throw new Error("That extension is too large to import.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength > MAX_VSIX_BYTES) {
    throw new Error("That extension is too large to import.");
  }

  return colorThemesFromVsix(
    bytes,
    `${extension.namespace}.${extension.name}`.toLowerCase(),
  );
}
