import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Chromium zoom level for 50%, where each level scales by 20%. */
const MIN_ZOOM_LEVEL = -3.8;

/** Chromium zoom level for 300%. */
const MAX_ZOOM_LEVEL = 6;

/** Keeps a changed or restored zoom level inside the supported range. */
function clampZoomLevel(level: number) {
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, level));
}

type ZoomStore = {
  /** Chromium zoom level, where 0 is 100%. */
  level: number;
  setLevel: (level: number) => void;
};

/** Window zoom, remembered across launches. */
export const useZoomStore = create<ZoomStore>()(
  persist(
    (set) => ({
      level: 0,
      setLevel: (level) => set({ level: clampZoomLevel(level) }),
    }),
    {
      name: "lunarscribe-zoom",
      merge: (persisted, current) => {
        const level =
          persisted instanceof Object && "level" in persisted
            ? Number(persisted.level)
            : null;

        return {
          ...current,
          level:
            level !== null && Number.isFinite(level)
              ? clampZoomLevel(level)
              : current.level,
        };
      },
    },
  ),
);
