import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "lunarscribe-theme";

const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];

/** Where the theme toggle was pressed; the incoming theme is revealed from this point. */
type ThemeRevealOrigin = {
  x: number;
  y: number;
};

type ThemeProviderState = {
  theme: Theme;
  toggleTheme: (origin: ThemeRevealOrigin) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

/** Reads the saved theme, falling back to the OS preference. */
function readInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  const saved = THEMES.find((theme) => theme === stored);

  if (saved) {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Applies the theme as a `light`/`dark` class on <html> and remembers it in
 * localStorage. Based on the shadcn Vite dark-mode guide.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  };

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
    <ThemeProviderContext.Provider value={{ theme, toggleTheme }}>
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
