import { create } from "zustand";
import { persist } from "zustand/middleware";

type SidebarStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/** Whether the sidebar is expanded, remembered across launches. */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      setOpen: (open) => set({ open }),
    }),
    { name: "lunarscribe-sidebar" },
  ),
);
