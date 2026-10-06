import { Appearance } from "react-native";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Theme } from "@/lib/editor-types";
import { fileStorage } from "@/lib/file-storage";

type AppearanceStore = {
  theme: Theme;
  lightColorTheme: string | null; // null = the colors in global.css
  darkColorTheme: string | null; // null = the colors in global.css
  setTheme: (theme: Theme) => void;
  setLightColorTheme: (colorTheme: string | null) => void;
  setDarkColorTheme: (colorTheme: string | null) => void;
  /** Drops both color themes, so the colors in global.css apply again. */
  resetColorThemes: () => void;
};

/** Remembers the theme and color themes across launches; the OS preference picks the first theme. */
export const useAppearanceStore = create<AppearanceStore>()(
  persist(
    (set) => ({
      theme: Appearance.getColorScheme() === "dark" ? "dark" : "light",
      lightColorTheme: null,
      darkColorTheme: null,
      setTheme: (theme) => set({ theme }),
      setLightColorTheme: (lightColorTheme) => set({ lightColorTheme }),
      setDarkColorTheme: (darkColorTheme) => set({ darkColorTheme }),
      resetColorThemes: () =>
        set({ lightColorTheme: null, darkColorTheme: null }),
    }),
    { name: "lunarscribe-appearance", storage: fileStorage },
  ),
);
