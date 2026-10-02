import { createContext, type ReactNode, useContext, useEffect } from "react";

import { useAppearanceStore } from "@/stores/appearance-store";
import {
  COLOR_TOKENS,
  findColorTheme,
  type ColorPalette,
} from "@/themes/color-themes";

/** Where the dark mode toggle was pressed; the incoming theme is revealed from this point. */
type ThemeRevealOrigin = {
  x: number;
  y: number;
};

type ThemeProviderState = {
  toggleTheme: (origin: ThemeRevealOrigin) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

/** Writes the color theme's tokens onto <html>; tokens it omits fall back to globals.css. */
function applyColorTheme(root: HTMLElement, palette?: ColorPalette) {
  for (const token of COLOR_TOKENS) {
    const value = palette?.[token];

    if (value === undefined) {
      root.style.removeProperty(`--${token}`);
    } else {
      root.style.setProperty(`--${token}`, value);
    }
  }
}

/** Puts the theme and its color theme on <html>, and flips the theme on demand. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppearanceStore((state) => state.theme);
  const lightColorTheme = useAppearanceStore((state) => state.lightColorTheme);
  const darkColorTheme = useAppearanceStore((state) => state.darkColorTheme);
  const setTheme = useAppearanceStore((state) => state.setTheme);

  const colorTheme = findColorTheme(
    theme === "dark" ? darkColorTheme : lightColorTheme,
  );

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);
    applyColorTheme(root, colorTheme?.[theme]);
  }, [theme, colorTheme]);

  const toggleTheme = ({ x, y }: ThemeRevealOrigin) => {
    const next = theme === "light" ? "dark" : "light";

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!document.startViewTransition || reducedMotion) {
      setTheme(next);

      return;
    }

    const root = document.documentElement;

    root.style.setProperty(
      "--theme-reveal-x",
      `${(x / window.innerWidth) * 100}%`,
    );
    root.style.setProperty(
      "--theme-reveal-y",
      `${(y / window.innerHeight) * 100}%`,
    );

    document.startViewTransition(() => setTheme(next));
  };

  return (
    <ThemeProviderContext.Provider value={{ toggleTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
