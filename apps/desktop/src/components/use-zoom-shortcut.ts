import { useEffect } from "react";

import { useZoomStore } from "@/stores/zoom-store";

/** Zoom steps for each key, with `null` resetting to 100%. */
const ZOOM_KEYS = new Map<string, number | null>([
  ["+", 1],
  ["=", 1],
  ["-", -1],
  ["_", -1],
  ["0", null],
]);

/** Ctrl or Cmd with +, - and 0 zooms the window. = and _ cover keyboards where + needs Shift. */
export function useZoomShortcut() {
  const percent = useZoomStore((state) => state.percent);

  useEffect(() => {
    window.lunarscribe.setZoomFactor(percent / 100);
  }, [percent]);

  useEffect(() => {
    const handleZoomShortcut = (event: KeyboardEvent) => {
      const steps = ZOOM_KEYS.get(event.key);

      if (
        steps === undefined ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.isComposing
      ) {
        return;
      }

      // Also stops Electron's default menu from zooming a second time.
      event.preventDefault();
      event.stopPropagation();

      const { setPercent, stepZoom } = useZoomStore.getState();

      if (steps === null) {
        setPercent(100);
      } else {
        stepZoom(steps);
      }
    };

    window.addEventListener("keydown", handleZoomShortcut, true);

    return () =>
      window.removeEventListener("keydown", handleZoomShortcut, true);
  }, []);
}
