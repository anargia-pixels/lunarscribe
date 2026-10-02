import { create } from "zustand";
import { persist } from "zustand/middleware";

const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];

// Types

type AppearanceStore = {
  theme: Theme; // light or dark
  lightColorTheme: string | null; // null = the colors in globals.css
  darkColorTheme: string | null; // null = the colors in globals.css
  setTheme: (theme: Theme) => void;
  setLightColorTheme: (colorTheme: string | null) => void;
  setDarkColorTheme: (colorTheme: string | null) => void;
  /** Drops both color themes, so the colors in globals.css apply again. */
  resetColorThemes: () => void;
};

/** Remembers the theme and its color themes across launches. */
export const useAppearanceStore = create<AppearanceStore>()(
  persist(
    (set) => ({
      theme: window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light", // the OS preference picks the first theme
      lightColorTheme: null,
      darkColorTheme: null,
      setTheme: (theme) => set({ theme }),
      setLightColorTheme: (lightColorTheme) => set({ lightColorTheme }),
      setDarkColorTheme: (darkColorTheme) => set({ darkColorTheme }),
      resetColorThemes: () =>
        set({ lightColorTheme: null, darkColorTheme: null }),
    }),
    { name: "lunarscribe-appearance" },
  ),
);
