import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isSidebarSection } from "@/lib/sidebar-sections";
import type { SidebarSection } from "@/lib/sidebar-sections";

type SidebarStore = {
  open: boolean;
  sectionsOpen: Record<SidebarSection, boolean>;
  setOpen: (open: boolean) => void;
  setSectionOpen: (section: SidebarSection, open: boolean) => void;
};

/** Sidebar visibility and each section's expanded state, remembered across launches. */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      sectionsOpen: { notes: true, drawings: true, "external-files": true },
      setOpen: (open) => set({ open }),
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

        return {
          ...current,
          open: "open" in persisted ? persisted.open !== false : current.open,
          sectionsOpen,
        };
      },
    },
  ),
);
