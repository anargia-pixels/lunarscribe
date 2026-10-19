import type { Outline } from "@lunarscribe/components/editor/plugins/heading-outline-plugin";
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
  outlineOpen: boolean;
  outlineWidth: number;
  /** The markdown editor's headings; null while no markdown editor is shown. */
  outline: Outline | null;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setSection: (section: SidebarSection) => void;
  setOutlineOpen: (outlineOpen: boolean) => void;
  setOutlineWidth: (outlineWidth: number) => void;
  toggleOutline: () => void;
  setOutline: (outline: Outline | null) => void;
};

/**
 * Sidebar visibility, width and selected section tab, and outline sidebar visibility and width,
 * remembered across launches, plus the outline of the shown markdown buffer.
 */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      section: "notes",
      outlineOpen: true,
      outlineWidth: SIDEBAR_DEFAULT_WIDTH,
      outline: null,
      setOpen: (open) => set({ open }),
      setWidth: (width) => set({ width: clampWidth(width) }),
      setSection: (section) => set({ section }),
      setOutlineOpen: (outlineOpen) => set({ outlineOpen }),
      setOutlineWidth: (outlineWidth) =>
        set({ outlineWidth: clampWidth(outlineWidth) }),
      toggleOutline: () =>
        set((state) => ({ outlineOpen: !state.outlineOpen })),
      setOutline: (outline) => set({ outline }),
    }),
    {
      name: "lunarscribe-sidebar",
      // The outline belongs to the mounted editor, so it is never saved.
      partialize: ({ open, width, section, outlineOpen, outlineWidth }) => ({
        open,
        width,
        section,
        outlineOpen,
        outlineWidth,
      }),
      // Saved state may predate a field or hold an unknown section; keep defaults for those.
      merge: (persisted, current) => {
        if (!(persisted instanceof Object)) {
          return current;
        }

        const section =
          "section" in persisted ? String(persisted.section) : null;

        const width = "width" in persisted ? Number(persisted.width) : null;

        const outlineWidth =
          "outlineWidth" in persisted ? Number(persisted.outlineWidth) : null;

        return {
          ...current,
          open: "open" in persisted ? persisted.open !== false : current.open,
          outlineOpen:
            "outlineOpen" in persisted
              ? persisted.outlineOpen !== false
              : current.outlineOpen,
          outlineWidth:
            outlineWidth !== null && Number.isFinite(outlineWidth)
              ? clampWidth(outlineWidth)
              : current.outlineWidth,
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
