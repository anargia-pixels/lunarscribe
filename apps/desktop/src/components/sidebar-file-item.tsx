import { Button } from "@lunarscribe/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@lunarscribe/components/ui/context-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@lunarscribe/components/ui/sidebar";
import { Copy, Ellipsis, Pencil, Trash2, X } from "lucide-react";
import { useRef } from "react";

import type { FileTarget } from "@/lib/editor-files";
import { stemOf } from "@/stores/buffer-store";

export type FileMenuState = { key: string; anchor: HTMLElement | null };

/** One sidebar entry with a menu shared by right-click and its action button. */
export function SidebarFileItem({
  target,
  menu,
  onMenuChange,
  isActive,
  onOpen,
  onRename,
  onCopyPath,
  onDelete,
}: {
  target: FileTarget;
  menu: FileMenuState | null;
  onMenuChange: (open: boolean, anchor: HTMLElement | null) => void;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onCopyPath: () => void;
  onDelete: () => void;
}) {
  const isMenuOpen = menu !== null;
  const isExternal = target.kind === "external";
  const label = isExternal ? target.name : stemOf(target.name);
  const actionRef = useRef<HTMLButtonElement>(null);

  return (
    <ContextMenu
      open={isMenuOpen}
      onOpenChange={(open) => onMenuChange(open, menu?.anchor ?? null)}
    >
      <ContextMenuTrigger
        render={
          <SidebarMenuItem data-sidebar-file-item className="overflow-clip" />
        }
        onContextMenu={() => onMenuChange(true, null)}
      >
        <SidebarMenuButton
          className="h-auto"
          isActive={isActive}
          title={target.kind === "external" ? target.path : target.name}
          onClick={onOpen}
        >
          <span>{label}</span>
        </SidebarMenuButton>
        <SidebarMenuAction
          ref={actionRef}
          render={<Button variant="ghost" size="icon-xs" />}
          showOnHover
          aria-label={`Actions for ${target.name}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={(event) => {
            onMenuChange(!isMenuOpen, event.currentTarget);
          }}
        >
          <Ellipsis />
        </SidebarMenuAction>
      </ContextMenuTrigger>
      <ContextMenuContent
        anchor={menu?.anchor ?? undefined}
        finalFocus={actionRef}
      >
        <ContextMenuItem onClick={onRename}>
          <Pencil />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopyPath}>
          <Copy />
          Copy path
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          {isExternal ? <X /> : <Trash2 />}
          {isExternal ? "Remove" : "Delete"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
