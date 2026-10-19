import { useEffect } from "react";

import { useSidebarStore } from "@/stores/sidebar-store";

/** Ctrl+Alt+B (⌘+Alt+B on macOS) toggles the outline sidebar. */
export function useOutlineShortcut() {
  useEffect(() => {
    const handleOutlineShortcut = (event: KeyboardEvent) => {
      // Alt changes the typed key on macOS, so match the physical key.
      if (
        event.code !== "KeyB" ||
        !(event.ctrlKey || event.metaKey) ||
        !event.altKey ||
        event.shiftKey ||
        event.isComposing
      ) {
        return;
      }

      event.preventDefault();
      useSidebarStore.getState().toggleOutline();
    };

    window.addEventListener("keydown", handleOutlineShortcut);

    return () => window.removeEventListener("keydown", handleOutlineShortcut);
  }, []);
}
