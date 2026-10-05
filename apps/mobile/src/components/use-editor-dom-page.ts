import { useEffect, useLayoutEffect } from "react";

import type { Theme } from "@/lib/editor-types";

/**
 * Page setup shared by the editor DOM components: applies the theme, and sizes the
 * page to the visual viewport, since iOS keeps the WebView full height under the
 * keyboard.
 */
export function useEditorDomPage(theme: Theme) {
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
  }, [theme]);
}
