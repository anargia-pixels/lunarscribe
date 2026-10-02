import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarSection = "notes" | "drawings" | "external-files";

type SidebarStore = {
  open: boolean;
  sectionsOpen: Partial<Record<SidebarSection, boolean>>;
  setOpen: (open: boolean) => void;
  setSectionOpen: (section: SidebarSection, open: boolean) => void;
};

/** Sidebar visibility and each section's expanded state, remembered across launches. */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      sectionsOpen: {},
      setOpen: (open) => set({ open }),
      setSectionOpen: (section, open) =>
        set((state) => ({
          sectionsOpen: { ...state.sectionsOpen, [section]: open },
        })),
    }),
    { name: "lunarscribe-sidebar" },
  ),
);
