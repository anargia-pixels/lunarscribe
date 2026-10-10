import { isSidebarSection } from "@lunarscribe/utils/sidebar-sections";
import type { SidebarSection } from "@lunarscribe/utils/sidebar-sections";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type SidebarStore = {
  open: boolean;
  section: SidebarSection;
  setOpen: (open: boolean) => void;
  setSection: (section: SidebarSection) => void;
};

/** Sidebar visibility and selected section tab, remembered across launches. */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      section: "notes",
      setOpen: (open) => set({ open }),
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

        return {
          ...current,
          open: "open" in persisted ? persisted.open !== false : current.open,
          section:
            section !== null && isSidebarSection(section)
              ? section
              : current.section,
        };
      },
    },
  ),
);
