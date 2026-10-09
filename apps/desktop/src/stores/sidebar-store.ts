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
  sectionsOpen: Record<SidebarSection, boolean>;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setSectionOpen: (section: SidebarSection, open: boolean) => void;
};

/** Sidebar visibility, width and each section's expanded state, remembered across launches. */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      sectionsOpen: { notes: true, drawings: true, "external-files": true },
      setOpen: (open) => set({ open }),
      setWidth: (width) => set({ width: clampWidth(width) }),
      setSectionOpen: (section, open) =>
        set((state) => ({
          sectionsOpen: { ...state.sectionsOpen, [section]: open },
        })),
    }),
    {
      name: "lunarscribe-sidebar",
      // Older saved state omitted open sections. Keep those defaults during hydration.
      merge: (persisted, current) => {
        if (!(persisted instanceof Object)) {
          return current;
        }

        const previousSections =
          "sectionsOpen" in persisted ? persisted.sectionsOpen : null;

        const sectionsOpen = { ...current.sectionsOpen };

        if (previousSections instanceof Object) {
          for (const [section, open] of Object.entries(previousSections)) {
            if (isSidebarSection(section)) {
              sectionsOpen[section] = open !== false;
            }
          }
        }

        const width = "width" in persisted ? Number(persisted.width) : null;

        return {
          ...current,
          open: "open" in persisted ? persisted.open !== false : current.open,
          width:
            width !== null && Number.isFinite(width)
              ? clampWidth(width)
              : current.width,
          sectionsOpen,
        };
      },
    },
  ),
);
