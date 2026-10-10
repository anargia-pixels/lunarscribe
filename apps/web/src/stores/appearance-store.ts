import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

// Types

type AppearanceStore = {
  theme: Theme;
  lightColorTheme: string | null; // null = the colors in globals.css
  darkColorTheme: string | null; // null = the colors in globals.css
  uiFont: string;
  bufferFont: string;
  codeFont: string;
  showEditorToolbar: boolean;
  setTheme: (theme: Theme) => void;
  setLightColorTheme: (colorTheme: string | null) => void;
  setDarkColorTheme: (colorTheme: string | null) => void;
  setUiFont: (font: string) => void;
  setBufferFont: (font: string) => void;
  setCodeFont: (font: string) => void;
  setShowEditorToolbar: (showEditorToolbar: boolean) => void;
  /** Drops both color themes, so the colors in globals.css apply again. */
  resetColorThemes: () => void;
};

/** Remembers the theme, color themes, fonts, and toolbar visibility across launches. */
export const useAppearanceStore = create<AppearanceStore>()(
  persist(
    (set) => ({
      theme: window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light", // the OS preference picks the first theme
      lightColorTheme: null,
      darkColorTheme: null,
      uiFont: "Poppins",
      bufferFont: "Poppins",
      codeFont: "Roboto Mono",
      showEditorToolbar: true,
      setTheme: (theme) => set({ theme }),
      setLightColorTheme: (lightColorTheme) => set({ lightColorTheme }),
      setDarkColorTheme: (darkColorTheme) => set({ darkColorTheme }),
      setUiFont: (uiFont) => set({ uiFont }),
      setBufferFont: (bufferFont) => set({ bufferFont }),
      setCodeFont: (codeFont) => set({ codeFont }),
      setShowEditorToolbar: (showEditorToolbar) => set({ showEditorToolbar }),
      resetColorThemes: () =>
        set({ lightColorTheme: null, darkColorTheme: null }),
    }),
    { name: "lunarscribe-appearance" },
  ),
);
