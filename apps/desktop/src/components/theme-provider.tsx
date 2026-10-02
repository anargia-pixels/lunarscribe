import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
} from "react";
import { flushSync } from "react-dom";

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

/** Writes a complete palette onto <html>; clearing it restores globals.css. */
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
  const uiFont = useAppearanceStore((state) => state.uiFont);
  const bufferFont = useAppearanceStore((state) => state.bufferFont);
  const codeFont = useAppearanceStore((state) => state.codeFont);

  const colorTheme = findColorTheme(
    theme === "dark" ? darkColorTheme : lightColorTheme,
  );

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);
    applyColorTheme(root, colorTheme?.[theme]);
  }, [theme, colorTheme]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    // Escape family names so spaces, quotes, and punctuation stay part of the name.
    const uiFamily = `"${CSS.escape(uiFont)}", Poppins, ui-sans-serif, sans-serif, system-ui`;
    const bufferFamily = `"${CSS.escape(bufferFont)}", Poppins, ui-sans-serif, sans-serif, system-ui`;
    const codeFamily = `"${CSS.escape(codeFont)}", "Roboto Mono", ui-monospace, monospace`;

    root.style.setProperty("--font-ui", uiFamily);
    root.style.setProperty("--font-buffer", bufferFamily);
    root.style.setProperty("--font-code", codeFamily);
  }, [uiFont, bufferFont, codeFont]);

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

    document.startViewTransition(() => {
      // The transition captures the new palette after React updates <html>.
      flushSync(() => setTheme(next));
    });
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
