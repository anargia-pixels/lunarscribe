import { OutlineSidebar } from "@lunarscribe/components/sidebar/outline-sidebar";

import { useBufferStore } from "@/stores/buffer-store";
import { useSidebarStore } from "@/stores/sidebar-store";

/** The outline sidebar for the active buffer, shown only for markdown buffers. */
export function AppOutlineSidebar() {
  // Select the kind alone, so typing in the buffer does not re-render the outline.
  const isMarkdown = useBufferStore(
    (state) =>
      state.buffers.find(({ id }) => id === state.activeId)?.kind ===
      "markdown",
  );

  const open = useSidebarStore((state) => state.outlineOpen);
  const setOpen = useSidebarStore((state) => state.setOutlineOpen);
  const width = useSidebarStore((state) => state.outlineWidth);
  const setWidth = useSidebarStore((state) => state.setOutlineWidth);
  const outline = useSidebarStore((state) => state.outline);

  if (!isMarkdown) {
    return null;
  }

  return (
    <OutlineSidebar
      open={open}
      onOpenChange={setOpen}
      width={width}
      onWidthChange={setWidth}
      headings={outline?.headings ?? []}
      onSelect={(key) => outline?.goToHeading(key)}
    />
  );
}
