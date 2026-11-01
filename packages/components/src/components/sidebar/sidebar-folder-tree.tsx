import type { FileMenuState } from "@lunarscribe/components/sidebar/sidebar-file-item";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@lunarscribe/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@lunarscribe/components/ui/context-menu";
import {
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuSub,
} from "@lunarscribe/components/ui/sidebar";
import type {
  SavedTreeFile,
  SavedTreeFolder,
  SavedTreeNode,
} from "@lunarscribe/utils/saved-paths";
import {
  ChevronRight,
  Ellipsis,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  PenTool,
  Trash2,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { useSavedFileDrop } from "./saved-file-drag";

import "./sidebar-file-item.css";

/** How long a dragged file hovers over a closed folder before it opens, in ms. */
const DRAG_OPEN_DELAY_MS = 600;

/** What a folder's menu can do; each callback gets the folder's path. */
export type FolderActions = {
  onNewNote: (folder: string) => void;
  onNewDrawing: (folder: string) => void;
  onNewFolder: (folder: string) => void;
  onRename: (folder: string) => void;
  onDelete: (folder: string) => void;
};

/** The menu key of a folder, kept apart from file keys in the shared menu state. */
export function folderMenuKey(folder: string) {
  return `folder:${folder}`;
}

type TreeProps = {
  nodes: readonly SavedTreeNode[];
  openFolders: ReadonlySet<string>;
  onFolderOpenChange: (folder: string, open: boolean) => void;
  menu: FileMenuState | null;
  onMenuChange: (
    key: string,
    open: boolean,
    anchor: HTMLElement | null,
  ) => void;
  actions: FolderActions;
  /** Moves a saved file dropped on a folder into it. */
  onMoveFile: (path: string, folder: string) => void;
  renderFile: (file: SavedTreeFile) => ReactNode;
};

/** One folder: a row that expands into a SidebarMenuSub of its files and subfolders. */
function SidebarFolderItem({
  folder,
  ...tree
}: Omit<TreeProps, "nodes"> & { folder: SavedTreeFolder }) {
  const {
    openFolders,
    onFolderOpenChange,
    menu,
    onMenuChange,
    actions,
    onMoveFile,
  } = tree;

  const key = folderMenuKey(folder.path);
  const folderMenu = menu?.key === key ? menu : null;
  const isMenuOpen = folderMenu !== null;
  const isOpen = openFolders.has(folder.path);
  const actionRef = useRef<HTMLButtonElement>(null);
  // Dropping anywhere in the folder, its files included, moves the file into it.
  const { isOver, dropProps } = useSavedFileDrop(folder.path, onMoveFile);

  // A closed folder opens when a file hovers over it, so it can be dropped deeper.
  useEffect(() => {
    if (!isOver || isOpen) {
      return;
    }

    const timer = setTimeout(
      () => onFolderOpenChange(folder.path, true),
      DRAG_OPEN_DELAY_MS,
    );

    return () => clearTimeout(timer);
  }, [isOver, isOpen, folder.path, onFolderOpenChange]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => onFolderOpenChange(folder.path, open)}
      render={
        <li
          data-sidebar="menu-item"
          data-drop-target={isOver ? "" : undefined}
          className="data-drop-target:bg-sidebar-accent/60 relative rounded-md"
          {...dropProps}
        />
      }
    >
      {/* The hover group stays on this row, so hovering a child shows only its own action. */}
      <div data-sidebar-folder-row className="group/menu-item relative">
        <ContextMenu
          open={isMenuOpen}
          onOpenChange={(open) =>
            onMenuChange(key, open, folderMenu?.anchor ?? null)
          }
        >
          <ContextMenuTrigger
            render={
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton className="h-auto" title={folder.path} />
                }
              />
            }
            onContextMenu={() => onMenuChange(key, true, null)}
          >
            <ChevronRight className="text-muted-foreground transition-transform duration-200 in-data-panel-open:rotate-90 motion-reduce:transition-none" />
            {isOpen ? <FolderOpen /> : <Folder />}
            <span>{folder.name}</span>
          </ContextMenuTrigger>
          {folder.fileCount > 0 && (
            <SidebarMenuBadge>{folder.fileCount}</SidebarMenuBadge>
          )}
          <SidebarMenuAction
            ref={actionRef}
            render={<Button variant="ghost" size="icon-xs" />}
            showOnHover
            aria-label={`Actions for folder ${folder.name}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={(event) =>
              onMenuChange(key, !isMenuOpen, event.currentTarget)
            }
          >
            <Ellipsis />
          </SidebarMenuAction>
          <ContextMenuContent
            anchor={folderMenu?.anchor ?? undefined}
            finalFocus={actionRef}
          >
            <ContextMenuItem onClick={() => actions.onNewNote(folder.path)}>
              <FilePlus />
              New note
            </ContextMenuItem>
            <ContextMenuItem onClick={() => actions.onNewDrawing(folder.path)}>
              <PenTool />
              New drawing
            </ContextMenuItem>
            <ContextMenuItem onClick={() => actions.onNewFolder(folder.path)}>
              <FolderPlus />
              New folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => actions.onRename(folder.path)}>
              <Pencil />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onClick={() => actions.onDelete(folder.path)}
            >
              <Trash2 />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <CollapsibleContent>
        <SidebarMenuSub>
          {folder.children.length > 0 ? (
            <SidebarFolderTree nodes={folder.children} {...tree} />
          ) : (
            <li className="text-muted-foreground px-2 py-1.5 text-xs">
              Empty folder
            </li>
          )}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Saved files nested under collapsible folders, for use inside a SidebarMenu. Files render
 * through `renderFile`, so each app wires its own file actions; folders share one menu.
 */
export function SidebarFolderTree({ nodes, ...tree }: TreeProps) {
  return nodes.map((node) =>
    node.kind === "folder" ? (
      <SidebarFolderItem key={node.path} folder={node} {...tree} />
    ) : (
      tree.renderFile(node)
    ),
  );
}

/**
 * The top level of the saved file tree. A file dropped here, outside any folder, moves to
 * the top level; the bottom padding leaves room to drop below the last item.
 */
export function SidebarSavedFilesDropZone({
  onMoveFile,
  children,
}: {
  onMoveFile: (path: string, folder: string) => void;
  children: ReactNode;
}) {
  const { isOver, dropProps } = useSavedFileDrop("", onMoveFile);

  return (
    <div
      data-drop-target={isOver ? "" : undefined}
      className="data-drop-target:bg-sidebar-accent/30 min-h-full rounded-md pb-16"
      {...dropProps}
    >
      {children}
    </div>
  );
}
