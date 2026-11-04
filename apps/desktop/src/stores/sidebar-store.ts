import type { Outline } from "@lunarscribe/components/editor/plugins/heading-outline-plugin";
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
  /** Paths of the expanded folders in the sidebar. */
  openFolders: string[];
  outlineOpen: boolean;
  outlineWidth: number;
  /** The markdown editor's headings; null while no markdown editor is shown. */
  outline: Outline | null;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setFolderOpen: (folder: string, open: boolean) => void;
  setOutlineOpen: (outlineOpen: boolean) => void;
  setOutlineWidth: (outlineWidth: number) => void;
  toggleOutline: () => void;
  setOutline: (outline: Outline | null) => void;
};

/**
 * Sidebar visibility, width and expanded folders, and outline sidebar visibility and width,
 * remembered across launches, plus the outline of the shown markdown buffer.
 */
export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      openFolders: [],
      outlineOpen: true,
      outlineWidth: SIDEBAR_DEFAULT_WIDTH,
      outline: null,
      setOpen: (open) => set({ open }),
      setWidth: (width) => set({ width: clampWidth(width) }),
      setFolderOpen: (folder, open) =>
        set((state) => ({
          openFolders: open
            ? [...new Set([...state.openFolders, folder])]
            : state.openFolders.filter((candidate) => candidate !== folder),
        })),
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
      partialize: ({
        open,
        width,
        openFolders,
        outlineOpen,
        outlineWidth,
      }) => ({
        open,
        width,
        openFolders,
        outlineOpen,
        outlineWidth,
      }),
      // Saved state may predate a field; keep defaults for those.
      merge: (persisted, current) => {
        if (!(persisted instanceof Object)) {
          return current;
        }

        const width = "width" in persisted ? Number(persisted.width) : null;

        const openFolders =
          "openFolders" in persisted && Array.isArray(persisted.openFolders)
            ? persisted.openFolders.map(String)
            : current.openFolders;

        const outlineWidth =
          "outlineWidth" in persisted ? Number(persisted.outlineWidth) : null;

        return {
          ...current,
          open: "open" in persisted ? persisted.open !== false : current.open,
          openFolders,
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
        };
      },
    },
  ),
);
