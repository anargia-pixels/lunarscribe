import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@lunarscribe/components/ui/sidebar";
import { cn } from "@lunarscribe/utils/cn";
import type { NodeKey } from "lexical";
import type { CSSProperties } from "react";

import type { HeadingAnchor } from "../editor/heading-anchors";
import { SidebarResizeRail } from "./sidebar-resize-rail";

/** The markdown editor's h1 to h3 colors; h4 to h6 keep the foreground there too. */
const HEADING_COLORS = [
  "text-heading-1",
  "text-heading-2",
  "text-heading-3",
] as const;

/** Indent for each nesting depth; six heading levels nest at most five deep. */
const DEPTH_INDENTS = [
  "ms-0",
  "ms-3",
  "ms-6",
  "ms-9",
  "ms-12",
  "ms-15",
] as const;

/** Each heading with its nesting depth: the number of shallower headings still open above it. */
function withDepths(headings: HeadingAnchor[]) {
  const open: number[] = [];

  return headings.map((heading) => {
    while (open.length && (open.at(-1) ?? 0) >= heading.level) {
      open.pop();
    }

    open.push(heading.level);

    return { heading, depth: open.length - 1 };
  });
}

/**
 * VS Code style outline of a markdown buffer's headings on the right of the
 * window, indented by nesting and colored like the editor's headings. It has
 * its own sidebar provider, so it opens independently of the left sidebar;
 * the app owns `open`, `width` (in CSS pixels) and the shortcut that toggles it.
 */
export function OutlineSidebar({
  open,
  onOpenChange,
  width,
  onWidthChange,
  headings,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
  headings: HeadingAnchor[];
  onSelect: (key: NodeKey) => void;
}) {
  const sidebarStyle: CSSProperties & Record<"--sidebar-width", string> = {
    "--sidebar-width": `${width}px`,
  };

  return (
    <SidebarProvider
      open={open}
      onOpenChange={onOpenChange}
      keyboardShortcut={null}
      style={sidebarStyle}
      className="min-h-0 w-auto flex-none"
    >
      <Sidebar side="right">
        <div className="flex h-10 shrink-0 items-center border-b px-4 text-xs font-medium">
          Outline
        </div>
        <SidebarContent>
          <div className="p-2">
            {headings.length ? (
              <SidebarMenu aria-label="Outline">
                {withDepths(headings).map(({ heading, depth }) => (
                  <SidebarMenuItem key={heading.key}>
                    <SidebarMenuButton
                      size="sm"
                      title={heading.text}
                      onClick={() => onSelect(heading.key)}
                    >
                      <span
                        className={cn(
                          DEPTH_INDENTS[depth],
                          HEADING_COLORS[heading.level - 1],
                        )}
                      >
                        {heading.text}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <p className="text-muted-foreground px-2 py-1 text-xs">
                Headings in this note appear here.
              </p>
            )}
          </div>
        </SidebarContent>
        <SidebarResizeRail
          width={width}
          onWidthChange={onWidthChange}
          side="right"
        />
      </Sidebar>
    </SidebarProvider>
  );
}
