import { useEffect, useEffectEvent } from "react";

/** Calls `onOpen` on Ctrl+E before the editor or browser handles the key. */
export function useSearchShortcut(onOpen: () => void) {
  const open = useEffectEvent(onOpen);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "e" ||
        !event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!event.repeat) {
        open();
      }
    };

    window.addEventListener("keydown", handleSearchShortcut, true);

    return () =>
      window.removeEventListener("keydown", handleSearchShortcut, true);
  }, []);
}
