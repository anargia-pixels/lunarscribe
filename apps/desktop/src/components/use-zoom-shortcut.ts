import { useEffect } from "react";

import { useZoomStore } from "@/stores/zoom-store";

/** Zoom level change for each key, with `null` resetting to 100%. */
const ZOOM_KEYS = new Map<string, number | null>([
  ["+", 0.5],
  ["=", 0.5],
  ["-", -0.5],
  ["_", -0.5],
  ["0", null],
]);

/** Ctrl or Cmd with +, - and 0 zooms the window. = and _ cover keyboards where + needs Shift. */
export function useZoomShortcut() {
  const level = useZoomStore((state) => state.level);

  useEffect(() => {
    window.lunarscribe.setZoomLevel(level);
  }, [level]);

  useEffect(() => {
    const handleZoomShortcut = (event: KeyboardEvent) => {
      const change = ZOOM_KEYS.get(event.key);

      if (
        change === undefined ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.isComposing
      ) {
        return;
      }

      // Also stops Electron's default menu from zooming a second time.
      event.preventDefault();
      event.stopPropagation();

      const { level: current, setLevel } = useZoomStore.getState();

      setLevel(change === null ? 0 : current + change);
    };

    window.addEventListener("keydown", handleZoomShortcut, true);

    return () =>
      window.removeEventListener("keydown", handleZoomShortcut, true);
  }, []);
}
