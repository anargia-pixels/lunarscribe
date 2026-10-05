import {
  COLOR_TOKENS,
  type ColorPalette,
} from "@lunarscribe/components/themes/color-themes";
import { useEffect, useLayoutEffect } from "react";

import type { Theme } from "@/lib/editor-types";

/**
 * Page setup shared by the editor DOM components: applies the theme and its color
 * theme, and sizes the page to the visual viewport, since iOS keeps the WebView
 * full height under the keyboard.
 */
export function useEditorDomPage(theme: Theme, palette: ColorPalette | null) {
  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const fit = () => {
      document.documentElement.style.setProperty(
        "--editor-height",
        `${viewport.height}px`,
      );
      window.scrollTo(0, 0);
    };

    fit();
    viewport.addEventListener("resize", fit);

    return () => viewport.removeEventListener("resize", fit);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);

    // Writes a complete palette onto <html>; clearing it restores globals.css.
    for (const token of COLOR_TOKENS) {
      const value = palette?.[token];

      if (value === undefined) {
        root.style.removeProperty(`--${token}`);
      } else {
        root.style.setProperty(`--${token}`, value);
      }
    }
  }, [theme, palette]);
}
