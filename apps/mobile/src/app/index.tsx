import type { EditorKind } from "@lunarscribe/utils/file-kinds";
import type { FileSearchMatch } from "@lunarscribe/utils/file-search";
import { isImageFileName } from "@lunarscribe/utils/images";
import {
  allFolders,
  baseNameOf,
  buildSavedTree,
  folderOf,
  isInFolder,
} from "@lunarscribe/utils/saved-paths";
import type { SavedTreeNode } from "@lunarscribe/utils/saved-paths";
import { useRouter } from "expo-router";
import {
  ListGroup,
  Menu,
  SearchField,
  Separator,
  Typography,
  useThemeColor,
} from "heroui-native";
import { Plus, Settings } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";

import { DarkmodeToggle } from "@/components/darkmode-toggle";
import { DeleteFileDialog } from "@/components/delete-file-dialog";
import { DeleteFolderDialog } from "@/components/delete-folder-dialog";
import { FileErrorAlert } from "@/components/file-error-alert";
import { FileListItem } from "@/components/file-list-item";
import { FolderListItem } from "@/components/folder-list-item";
import { FolderNameDialog } from "@/components/folder-name-dialog";
import { MoveFileDialog } from "@/components/move-file-dialog";
import { PressableButton } from "@/components/pressable-button";
import { RenameFileDialog } from "@/components/rename-file-dialog";
import { SyncAlert } from "@/components/sync-alert";
import { searchFiles } from "@/lib/documents-folder";
import { rowEntering, rowLayout } from "@/lib/motion";
import { useActiveBuffer, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

type FileDialogState =
  | { kind: "rename" | "delete" | "move"; name: string }
  | { kind: "new-folder"; parent: string }
  | { kind: "rename-folder" | "delete-folder"; path: string };

/** A visible row: a file or folder of the tree, `depth` folders deep, or a search match. */
type Row = {
  node: SavedTreeNode;
  depth: number;
  description?: string;
};

/** Indents for each folder level, 1rem apart; deeper levels share the last one. */
const INDENTS = ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16", "pl-20"] as const;

/** The tree's rows top to bottom, descending only into open folders. */
function visibleRows(
  nodes: readonly SavedTreeNode[],
  openFolders: ReadonlySet<string>,
  depth = 0,
): Row[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(node.kind === "folder" && openFolders.has(node.path)
      ? visibleRows(node.children, openFolders, depth + 1)
      : []),
  ]);
}

/** Searches saved files as the query changes, dropping results from older queries. */
function useFileSearch(query: string) {
  const [matches, setMatches] = useState<FileSearchMatch[]>([]);

  useEffect(() => {
    let isCancelled = false;

    searchFiles(query).then(
      (results) => !isCancelled && setMatches(results),
      () => !isCancelled && setMatches([]),
    );

    return () => {
      isCancelled = true;
    };
  }, [query]);

  return matches;
}

function reportFileError(name: string, message: string) {
  useBufferStore.setState({ fileError: `${name}: ${message}` });
}

/** Saved notes, drawings and their folders; the mobile stand-in for the desktop sidebar. */
export default function FilesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<FileDialogState | null>(null);

  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const foreground = useThemeColor("foreground");

  const entries = useBufferStore((state) => state.entries);
  const refreshFiles = useBufferStore((state) => state.refreshFiles);
  const openFile = useBufferStore((state) => state.openFile);
  const createBuffer = useBufferStore((state) => state.createBuffer);
  const renameFile = useBufferStore((state) => state.renameFile);
  const deleteFile = useBufferStore((state) => state.deleteFile);
  const moveFile = useBufferStore((state) => state.moveFile);
  const createFolder = useBufferStore((state) => state.createFolder);
  const renameFolder = useBufferStore((state) => state.renameFolder);
  const deleteFolder = useBufferStore((state) => state.deleteFolder);
  const forceSyncFile = useBufferStore((state) => state.forceSyncFile);
  const forcePullFile = useBufferStore((state) => state.forcePullFile);
  const isSyncConnected = useSyncStore((state) => state.provider !== null);
  const activeFileName = useActiveBuffer()?.fileName ?? null;
  const matches = useFileSearch(query);

  useEffect(refreshFiles, [refreshFiles]);

  function setFolderOpen(folder: string, open: boolean) {
    setOpenFolders((current) => {
      const next = new Set(current);

      if (open) {
        next.add(folder);
      } else {
        next.delete(folder);
      }

      return next;
    });
  }

  function openInEditor(name: string) {
    // Images open in the image viewer; they are never buffers.
    if (isImageFileName(name)) {
      router.push({ pathname: "/image", params: { name } });

      return;
    }

    openFile(name).then(
      () => router.push("/editor"),
      (error) => reportFileError(name, String(error)),
    );
  }

  function createInEditor(kind: EditorKind, folder: string) {
    createBuffer(kind, folder);

    if (folder) {
      setFolderOpen(folder, true);
    }

    router.push("/editor");
  }

  const isSearching = query.trim() !== "";

  const tree = buildSavedTree(entries, (first, second) =>
    first.localeCompare(second),
  );

  // Search results are flat; each names its folder unless a matching line says more.
  const rows: Row[] = isSearching
    ? matches.map((match) => ({
        node: { kind: "file", path: match.name, name: baseNameOf(match.name) },
        depth: 0,
        description: match.lineContent ?? (folderOf(match.name) || undefined),
      }))
    : visibleRows(tree, openFolders);

  const renderRow = ({ node, description }: Row) =>
    node.kind === "folder" ? (
      <FolderListItem
        name={node.name}
        fileCount={node.fileCount}
        isOpen={openFolders.has(node.path)}
        onToggle={() => setFolderOpen(node.path, !openFolders.has(node.path))}
        onNewNote={() => createInEditor("markdown", node.path)}
        onNewDrawing={() => createInEditor("drawing", node.path)}
        onNewFolder={() => setDialog({ kind: "new-folder", parent: node.path })}
        onRename={() => setDialog({ kind: "rename-folder", path: node.path })}
        onDelete={() => setDialog({ kind: "delete-folder", path: node.path })}
      />
    ) : (
      <FileListItem
        name={node.path}
        description={description}
        isActive={node.path === activeFileName}
        onOpen={() => openInEditor(node.path)}
        onRename={() => setDialog({ kind: "rename", name: node.path })}
        onMove={
          isSearching
            ? undefined
            : () => setDialog({ kind: "move", name: node.path })
        }
        onDelete={() => setDialog({ kind: "delete", name: node.path })}
        onForceSync={
          isSyncConnected && !isImageFileName(node.path)
            ? () =>
                forceSyncFile(node.path).catch((error) =>
                  reportFileError(node.path, String(error)),
                )
            : undefined
        }
        onForcePull={
          isSyncConnected && !isImageFileName(node.path)
            ? () =>
                forcePullFile(node.path).catch((error) =>
                  reportFileError(node.path, String(error)),
                )
            : undefined
        }
      />
    );

  return (
    <View className="bg-background pt-safe pb-safe flex-1">
      <View className="h-12 flex-row items-center gap-1 px-3">
        <Typography.Heading type="h5" className="font-logo text-accent flex-1">
          Lunarscribe
        </Typography.Heading>
        <Menu>
          <Menu.Trigger asChild>
            <PressableButton
              variant="ghost"
              size="sm"
              isIconOnly
              accessibilityLabel="New note, drawing or folder"
            >
              <Plus size={20} color={foreground} />
            </PressableButton>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Overlay />
            <Menu.Content presentation="popover" width={180}>
              <Menu.Item onPress={() => createInEditor("markdown", "")}>
                <Menu.ItemTitle>New note</Menu.ItemTitle>
              </Menu.Item>
              <Menu.Item onPress={() => createInEditor("drawing", "")}>
                <Menu.ItemTitle>New drawing</Menu.ItemTitle>
              </Menu.Item>
              <Menu.Item
                onPress={() => setDialog({ kind: "new-folder", parent: "" })}
              >
                <Menu.ItemTitle>New folder</Menu.ItemTitle>
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu>
        <DarkmodeToggle />
        <PressableButton
          variant="ghost"
          size="sm"
          isIconOnly
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
        >
          <Settings size={18} color={foreground} />
        </PressableButton>
      </View>
      <View className="px-4 pb-3">
        <SearchField value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search saved files" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </View>
      <FileErrorAlert />
      <SyncAlert />
      <ScrollView contentContainerClassName="gap-2 px-4 pb-8">
        {rows.length > 0 ? (
          // Rows already there when the list appears do not animate in.
          <LayoutAnimationConfig skipEntering>
            <ListGroup>
              {rows.map((row, index) => (
                <Animated.View
                  key={`${row.node.kind}:${row.node.path}`}
                  entering={rowEntering}
                  layout={rowLayout}
                  className={INDENTS[Math.min(row.depth, INDENTS.length - 1)]}
                >
                  {index > 0 && <Separator className="mx-4" />}
                  {renderRow(row)}
                </Animated.View>
              ))}
            </ListGroup>
          </LayoutAnimationConfig>
        ) : (
          <Typography
            type="body-sm"
            color="muted"
            align="center"
            className="py-8"
          >
            {isSearching
              ? "No saved files match."
              : "No saved files yet. Press + to create a note, drawing or folder."}
          </Typography>
        )}
      </ScrollView>
      {dialog?.kind === "rename" && (
        <RenameFileDialog
          key={dialog.name}
          name={dialog.name}
          onClose={() => setDialog(null)}
          onRename={(title) => renameFile(dialog.name, title)}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteFileDialog
          key={dialog.name}
          name={dialog.name}
          onClose={() => setDialog(null)}
          onDelete={() => deleteFile(dialog.name)}
        />
      )}
      {dialog?.kind === "move" && (
        <MoveFileDialog
          key={dialog.name}
          name={dialog.name}
          folders={allFolders(entries)}
          onClose={() => setDialog(null)}
          onMove={async (folder) => {
            await moveFile(dialog.name, folder);

            if (folder) {
              setFolderOpen(folder, true);
            }
          }}
        />
      )}
      {dialog?.kind === "new-folder" && (
        <FolderNameDialog
          key={`new:${dialog.parent}`}
          title="New folder"
          description={
            dialog.parent
              ? `Inside ${baseNameOf(dialog.parent)}`
              : "In lunarscribe"
          }
          confirmLabel="Create"
          onClose={() => setDialog(null)}
          onConfirm={async (name) => {
            await createFolder(dialog.parent, name);

            if (dialog.parent) {
              setFolderOpen(dialog.parent, true);
            }
          }}
        />
      )}
      {dialog?.kind === "rename-folder" && (
        <FolderNameDialog
          key={`rename:${dialog.path}`}
          title="Rename folder"
          description={baseNameOf(dialog.path)}
          confirmLabel="Rename"
          initialName={baseNameOf(dialog.path)}
          onClose={() => setDialog(null)}
          onConfirm={(name) => renameFolder(dialog.path, name)}
        />
      )}
      {dialog?.kind === "delete-folder" && (
        <DeleteFolderDialog
          key={dialog.path}
          name={baseNameOf(dialog.path)}
          fileCount={
            entries.files.filter((name) => isInFolder(name, dialog.path)).length
          }
          onClose={() => setDialog(null)}
          onDelete={() => deleteFolder(dialog.path)}
        />
      )}
    </View>
  );
}
