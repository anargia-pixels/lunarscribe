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
import {
  CloudUpload,
  Copy,
  Download,
  Ellipsis,
  FileDown,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useRef } from "react";

export type FileMenuState = { key: string; anchor: HTMLElement | null };

/**
 * One sidebar entry with a menu shared by right-click and its action button. Menu items
 * whose callback is omitted are left out, so each app offers only what its platform can do.
 */
export function SidebarFileItem({
  name,
  label,
  title,
  isExternal,
  canExport,
  menu,
  onMenuChange,
  isActive,
  onOpen,
  onRename,
  onCopyPath,
  onDownload,
  onExportPdf,
  onExportDocx,
  isExporting,
  canForceSync,
  onForceSync,
  onDelete,
}: {
  name: string;
  label: string;
  title: string;
  isExternal: boolean;
  canExport: boolean;
  menu: FileMenuState | null;
  onMenuChange: (open: boolean, anchor: HTMLElement | null) => void;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onCopyPath?: () => void;
  onDownload?: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  isExporting: boolean;
  canForceSync: boolean;
  onForceSync?: () => void;
  onDelete: () => void;
}) {
  const isMenuOpen = menu !== null;
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
          title={title}
          onClick={onOpen}
        >
          <span>{label}</span>
        </SidebarMenuButton>
        <SidebarMenuAction
          ref={actionRef}
          render={<Button variant="ghost" size="icon-xs" />}
          showOnHover
          aria-label={`Actions for ${name}`}
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
        {onCopyPath && (
          <ContextMenuItem onClick={onCopyPath}>
            <Copy />
            Copy path
          </ContextMenuItem>
        )}
        {onDownload && (
          <ContextMenuItem onClick={onDownload}>
            <Download />
            Download
          </ContextMenuItem>
        )}
        {canExport && (
          <>
            <ContextMenuItem disabled={isExporting} onClick={onExportPdf}>
              <FileDown />
              Export as PDF
            </ContextMenuItem>
            <ContextMenuItem disabled={isExporting} onClick={onExportDocx}>
              <FileDown />
              Export as DOCX
            </ContextMenuItem>
          </>
        )}
        {onForceSync && (
          <ContextMenuItem disabled={!canForceSync} onClick={onForceSync}>
            <CloudUpload />
            Force changes to remote
          </ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          {isExternal ? <X /> : <Trash2 />}
          {isExternal ? "Remove" : "Delete"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
