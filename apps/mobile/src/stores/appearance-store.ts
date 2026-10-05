import { Appearance } from "react-native";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Theme } from "@/lib/editor-types";
import { fileStorage } from "@/lib/file-storage";

type AppearanceStore = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

/** Remembers the theme across launches; the OS preference picks the first one. */
export const useAppearanceStore = create<AppearanceStore>()(
  persist(
    (set) => ({
      theme: Appearance.getColorScheme() === "dark" ? "dark" : "light",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "lunarscribe-appearance", storage: fileStorage },
  ),
);
