import { isSidebarSection } from "@lunarscribe/utils/sidebar-sections";
import type { SidebarSection } from "@lunarscribe/utils/sidebar-sections";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Narrowest sidebar the rail can drag to, in CSS pixels. */
const SIDEBAR_MIN_WIDTH = 200;

/** Widest sidebar the rail can drag to, in CSS pixels. */
const SIDEBAR_MAX_WIDTH = 480;

/** Matches shadcn's 16rem sidebar. */
const SIDEBAR_DEFAULT_WIDTH = 256;

/** Keeps a dragged or restored width inside the sidebar bounds. */
function clampWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

type SidebarStore = {
  open: boolean;
  width: number;
  section: SidebarSection;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setSection: (section: SidebarSection) => void;
};

/** Sidebar visibility, width and selected section tab, remembered across launches. */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      section: "notes",
      setOpen: (open) => set({ open }),
      setWidth: (width) => set({ width: clampWidth(width) }),
      setSection: (section) => set({ section }),
    }),
    {
      name: "lunarscribe-sidebar",
      // Saved state may predate a field or hold an unknown section; keep defaults for those.
      merge: (persisted, current) => {
        if (!(persisted instanceof Object)) {
          return current;
        }

        const section =
          "section" in persisted ? String(persisted.section) : null;

        const width = "width" in persisted ? Number(persisted.width) : null;

        return {
          ...current,
          open: "open" in persisted ? persisted.open !== false : current.open,
          width:
            width !== null && Number.isFinite(width)
              ? clampWidth(width)
              : current.width,
          section:
            section !== null && isSidebarSection(section)
              ? section
              : current.section,
        };
      },
    },
  ),
);
