import {
  DEFAULT_EDITOR_SPACING,
  type EditorSpacing,
} from "@lunarscribe/components/themes/editor-spacing";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  type HighlightColor,
} from "@lunarscribe/components/themes/highlight-colors";
import type { ImportedColorTheme } from "@lunarscribe/components/themes/imported-color-themes";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

// Types

type AppearanceStore = {
  theme: Theme;
  lightColorTheme: string | null; // null = the colors in globals.css
  darkColorTheme: string | null; // null = the colors in globals.css
  importedColorThemes: ImportedColorTheme[];
  uiFont: string;
  bufferFont: string;
  codeFont: string;
  showEditorToolbar: boolean;
  highlightColor: HighlightColor;
  bufferSpacing: EditorSpacing;
  /** Whether the editor underlines misspelled words. */
  spellCheck: boolean;
  setTheme: (theme: Theme) => void;
  setLightColorTheme: (colorTheme: string | null) => void;
  setDarkColorTheme: (colorTheme: string | null) => void;
  /** Adds color themes, replacing any imported earlier under the same id. */
  addImportedColorThemes: (themes: ImportedColorTheme[]) => void;
  /** Removes an imported color theme; a theme that used it goes back to the default colors. */
  removeImportedColorTheme: (id: string) => void;
  setUiFont: (font: string) => void;
  setBufferFont: (font: string) => void;
  setCodeFont: (font: string) => void;
  setShowEditorToolbar: (showEditorToolbar: boolean) => void;
  setHighlightColor: (highlightColor: HighlightColor) => void;
  setBufferSpacing: (spacing: EditorSpacing) => void;
  setSpellCheck: (spellCheck: boolean) => void;
  /** Drops both color themes, so the colors in globals.css apply again. */
  resetColorThemes: () => void;
};

/**
 * Remembers the theme, color themes (built-in and imported), fonts, editor text
 * spacing, toolbar visibility, and highlighter color across launches.
 */
export const useAppearanceStore = create<AppearanceStore>()(
  persist(
    (set) => ({
      theme: window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light", // the OS preference picks the first theme
      lightColorTheme: null,
      darkColorTheme: null,
      importedColorThemes: [],
      uiFont: "Poppins",
      bufferFont: "Poppins",
      codeFont: "Roboto Mono",
      showEditorToolbar: true,
      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
      bufferSpacing: DEFAULT_EDITOR_SPACING,
      spellCheck: true,
      setTheme: (theme) => set({ theme }),
      setLightColorTheme: (lightColorTheme) => set({ lightColorTheme }),
      setDarkColorTheme: (darkColorTheme) => set({ darkColorTheme }),
      addImportedColorThemes: (themes) =>
        set((state) => {
          const ids = new Set(themes.map(({ id }) => id));

          return {
            importedColorThemes: [
              ...state.importedColorThemes.filter(({ id }) => !ids.has(id)),
              ...themes,
            ],
          };
        }),
      removeImportedColorTheme: (id) =>
        set((state) => ({
          importedColorThemes: state.importedColorThemes.filter(
            (theme) => theme.id !== id,
          ),
          lightColorTheme:
            state.lightColorTheme === id ? null : state.lightColorTheme,
          darkColorTheme:
            state.darkColorTheme === id ? null : state.darkColorTheme,
        })),
      setUiFont: (uiFont) => set({ uiFont }),
      setBufferFont: (bufferFont) => set({ bufferFont }),
      setCodeFont: (codeFont) => set({ codeFont }),
      setShowEditorToolbar: (showEditorToolbar) => set({ showEditorToolbar }),
      setHighlightColor: (highlightColor) => set({ highlightColor }),
      setBufferSpacing: (bufferSpacing) => set({ bufferSpacing }),
      setSpellCheck: (spellCheck) => set({ spellCheck }),
      resetColorThemes: () =>
        set({ lightColorTheme: null, darkColorTheme: null }),
    }),
    { name: "lunarscribe-appearance" },
  ),
);
