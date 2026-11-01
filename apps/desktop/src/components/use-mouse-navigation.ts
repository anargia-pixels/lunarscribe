import { useEffect } from "react";

/**
 * Steps back and forward through section-link history with the mouse's side buttons on
 * macOS, where Electron reports no app command for them; Linux handles them in main.
 */
export function useMouseNavigation() {
  useEffect(() => {
    if (window.lunarscribe.platform !== "darwin") {
      return;
    }

    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 3) {
        history.back();
      } else if (event.button === 4) {
        history.forward();
      }
    };

    window.addEventListener("mouseup", onMouseUp);

    return () => window.removeEventListener("mouseup", onMouseUp);
  }, []);
}
