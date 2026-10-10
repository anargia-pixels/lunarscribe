import { SidebarRail, useSidebar } from "@lunarscribe/components/ui/sidebar";
import type { PointerEvent } from "react";
import { useRef } from "react";

import { useSidebarStore } from "@/stores/sidebar-store";

/** Pointer travel that turns a rail click into a drag. */
const DRAG_THRESHOLD = 3;

type Drag = { startX: number; startWidth: number; hasMoved: boolean };

/** Sidebar rail that resizes the open sidebar on drag and toggles it on click. */
export function SidebarResizeRail() {
  const { open, toggleSidebar } = useSidebar();
  const width = useSidebarStore((state) => state.width);
  const setWidth = useSidebarStore((state) => state.setWidth);
  const drag = useRef<Drag | null>(null);
  const wasDragged = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!open || event.button !== 0) {
      return;
    }

    // Keeps the drag from selecting text in the sidebar or the editor.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startWidth: width,
      hasMoved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;

    if (!current) {
      return;
    }

    const offset = event.clientX - current.startX;

    if (!current.hasMoved && Math.abs(offset) < DRAG_THRESHOLD) {
      return;
    }

    if (!current.hasMoved) {
      current.hasMoved = true;
      // The sidebar's width transition would make it lag behind the pointer.
      event.currentTarget
        .closest<HTMLElement>("[data-slot=sidebar-wrapper]")
        ?.setAttribute("data-resizing", "");
    }

    setWidth(current.startWidth + offset);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    wasDragged.current = drag.current?.hasMoved ?? false;
    drag.current = null;
    event.currentTarget
      .closest<HTMLElement>("[data-slot=sidebar-wrapper]")
      ?.removeAttribute("data-resizing");
  };

  return (
    <SidebarRail
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        if (!wasDragged.current) {
          toggleSidebar();
        }

        wasDragged.current = false;
      }}
    />
  );
}
