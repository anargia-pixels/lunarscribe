import {
  ArrowUpRight01Icon,
  Cancel01Icon,
  CloudDownloadIcon,
  CloudUploadIcon,
  Copy01Icon,
  Delete02Icon,
  Download01Icon,
  FileDownloadIcon,
  Folder01Icon,
  FolderTransferIcon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@lunarscribe/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@lunarscribe/components/ui/context-menu";
import {
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@lunarscribe/components/ui/sidebar";
import { useRef } from "react";

import { savedFileDragProps } from "./saved-file-drag";

import "./sidebar-file-item.css";

export type FileMenuState = { key: string; anchor: HTMLElement | null };

/** A folder a saved file can move to; `folder` is its path, `""` for the top level. */
export type FileMoveTarget = { folder: string; label: string };

/**
 * One sidebar entry with a menu shared by right-click and its action button. Menu items
 * whose callback is omitted are left out, so each app offers only what its platform can do.
 * `accessedLabel` sits at the right edge and gives way to the action button on hover;
 * sidebar-file-item.css styles it.
 */
export function SidebarFileItem({
  name,
  label,
  title,
  accessedLabel,
  isExternal,
  dragPath,
  canExport,
  menu,
  onMenuChange,
  isActive,
  onOpen,
  onRename,
  onCopyPath,
  moveTargets,
  onMove,
  onDownload,
  onExportPdf,
  onExportDocx,
  isExporting,
  canForceSync,
  onForceSync,
  onForcePull,
  onDelete,
}: {
  name: string;
  label: string;
  title: string;
  accessedLabel?: string;
  isExternal: boolean;
  /** Makes the item draggable onto folders; the saved file's path. */
  dragPath?: string;
  canExport: boolean;
  menu: FileMenuState | null;
  onMenuChange: (open: boolean, anchor: HTMLElement | null) => void;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onCopyPath?: () => void;
  /** The folders offered under Move to, leaving out the file's own folder. */
  moveTargets?: readonly FileMoveTarget[];
  onMove?: (folder: string) => void;
  onDownload?: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  isExporting: boolean;
  canForceSync: boolean;
  onForceSync?: () => void;
  /** Replaces the local copy with the remote one; shares `canForceSync`. */
  onForcePull?: () => void;
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
        render={<SidebarMenuItem data-sidebar-file-item />}
        onContextMenu={() => onMenuChange(true, null)}
      >
        <SidebarMenuButton
          className="h-auto"
          isActive={isActive}
          title={title}
          onClick={onOpen}
          {...(dragPath === undefined ? {} : savedFileDragProps(dragPath))}
        >
          {isExternal && (
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              strokeWidth={2}
              aria-label="External file"
              data-external-file-icon
            />
          )}
          <span>{label}</span>
        </SidebarMenuButton>
        {accessedLabel && <SidebarMenuBadge>{accessedLabel}</SidebarMenuBadge>}
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
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </SidebarMenuAction>
      </ContextMenuTrigger>
      <ContextMenuContent
        anchor={menu?.anchor ?? undefined}
        finalFocus={actionRef}
      >
        <ContextMenuItem onClick={onRename}>
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
          Rename
        </ContextMenuItem>
        {onCopyPath && (
          <ContextMenuItem onClick={onCopyPath}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
            Copy01Icon path
          </ContextMenuItem>
        )}
        {onMove && moveTargets && moveTargets.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <HugeiconsIcon icon={FolderTransferIcon} strokeWidth={2} />
              Move to
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {moveTargets.map((target) => (
                <ContextMenuItem
                  key={target.folder}
                  onClick={() => onMove(target.folder)}
                >
                  <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                  {target.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {onDownload && (
          <ContextMenuItem onClick={onDownload}>
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
            Download01Icon
          </ContextMenuItem>
        )}
        {canExport && (
          <>
            <ContextMenuItem disabled={isExporting} onClick={onExportPdf}>
              <HugeiconsIcon icon={FileDownloadIcon} strokeWidth={2} />
              Export as PDF
            </ContextMenuItem>
            <ContextMenuItem disabled={isExporting} onClick={onExportDocx}>
              <HugeiconsIcon icon={FileDownloadIcon} strokeWidth={2} />
              Export as DOCX
            </ContextMenuItem>
          </>
        )}
        {onForceSync && (
          <ContextMenuItem disabled={!canForceSync} onClick={onForceSync}>
            <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} />
            Force changes to remote
          </ContextMenuItem>
        )}
        {onForcePull && (
          <ContextMenuItem disabled={!canForceSync} onClick={onForcePull}>
            <HugeiconsIcon icon={CloudDownloadIcon} strokeWidth={2} />
            Force changes from remote
          </ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          {isExternal ? (
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          ) : (
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          )}
          {isExternal ? "Remove" : "Delete"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
