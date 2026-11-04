import { DeleteFileDialog } from "@lunarscribe/components/file-dialog/delete-file-dialog";
import { DeleteFolderDialog } from "@lunarscribe/components/file-dialog/delete-folder-dialog";
import { FolderNameDialog } from "@lunarscribe/components/file-dialog/folder-name-dialog";
import { RenameFileDialog } from "@lunarscribe/components/file-dialog/rename-file-dialog";
import { useSearchShortcut } from "@lunarscribe/components/hooks/use-search-shortcut";
import { runFileAction } from "@lunarscribe/components/lib/file-feedback";
import { FileSearchDialog } from "@lunarscribe/components/search/file-search-dialog";
import { SettingsDialog } from "@lunarscribe/components/settings-dialog/settings-dialog";
import { AppSidebarHeader } from "@lunarscribe/components/sidebar/app-sidebar-header";
import { SidebarFileItem } from "@lunarscribe/components/sidebar/sidebar-file-item";
import type {
  FileMenuState,
  FileMoveTarget,
} from "@lunarscribe/components/sidebar/sidebar-file-item";
import { SidebarFileList } from "@lunarscribe/components/sidebar/sidebar-file-list";
import {
  SidebarFolderTree,
  SidebarSavedFilesDropZone,
} from "@lunarscribe/components/sidebar/sidebar-folder-tree";
import { SidebarResizeRail } from "@lunarscribe/components/sidebar/sidebar-resize-rail";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
} from "@lunarscribe/components/ui/sidebar";
import { toast } from "@lunarscribe/components/ui/toast";
import {
  allFolders,
  baseNameOf,
  buildSavedTree,
  folderOf,
  isInFolder,
} from "@lunarscribe/utils/saved-paths";
import type { SavedEntries } from "@lunarscribe/utils/saved-paths";
import { useEffect, useState } from "react";

import { downloadBlob } from "@/lib/download";
import type { FileTarget } from "@/lib/editor-files";
import { fileKey, isTextFile } from "@/lib/editor-files";
import { exportDocx } from "@/lib/export-docx";
import { exportPdf } from "@/lib/export-pdf";
import { pickTextFiles } from "@/lib/external-files";
import { searchFiles } from "@/lib/file-search";
import { MOD_KEY_LABEL } from "@/lib/platform";
import { formatTimeAgo } from "@/lib/relative-time";
import {
  createFolder as createSavedFolder,
  listFiles,
  onFilesChanged,
  readFile,
} from "@/lib/saved-files";
import { stemOf, useActiveBuffer, useBufferStore } from "@/stores/buffer-store";
import { useFileAccessStore } from "@/stores/file-access-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useSyncStore } from "@/stores/sync-store";

import { AppearancePane } from "./settings-dialog/appearance-pane";
import { SyncingPane } from "./settings-dialog/syncing-pane";
import { useTheme } from "./theme-provider";

type FileDialogState =
  | { kind: "rename"; target: FileTarget }
  | { kind: "delete"; target: Extract<FileTarget, { kind: "saved" }> }
  | { kind: "new-folder"; parent: string }
  | { kind: "rename-folder"; path: string }
  | { kind: "delete-folder"; path: string };

/** The sidebar: saved buffers, nested in their folders, followed by tracked external files. */
export function AppSidebar() {
  const [entries, setEntries] = useState<SavedEntries>({
    files: [],
    folders: [],
  });

  const [dialog, setDialog] = useState<FileDialogState | null>(null);
  const [menu, setMenu] = useState<FileMenuState | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isForcingSync, setIsForcingSync] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now);
  const accessedAt = useFileAccessStore((state) => state.accessedAt);

  const canForceSync = useSyncStore(
    (state) => state.provider !== null && !state.busy && !state.needsSignIn,
  );

  const openFile = useBufferStore((state) => state.openFile);
  const createBuffer = useBufferStore((state) => state.createBuffer);
  const deleteFile = useBufferStore((state) => state.deleteFile);
  const renameFile = useBufferStore((state) => state.renameFile);
  const moveFile = useBufferStore((state) => state.moveFile);
  const renameFolder = useBufferStore((state) => state.renameFolder);
  const deleteFolder = useBufferStore((state) => state.deleteFolder);
  const forceSyncFile = useBufferStore((state) => state.forceSyncFile);
  const forcePullFile = useBufferStore((state) => state.forcePullFile);

  const removeExternalFile = useBufferStore(
    (state) => state.removeExternalFile,
  );

  const openFolders = useSidebarStore((state) => state.openFolders);
  const setFolderOpen = useSidebarStore((state) => state.setFolderOpen);
  const sidebarWidth = useSidebarStore((state) => state.width);
  const setSidebarWidth = useSidebarStore((state) => state.setWidth);
  const { toggleTheme } = useTheme();

  const activeBuffer = useActiveBuffer();
  const externalFiles = useBufferStore((state) => state.externalFiles);

  const openExternalFile = useBufferStore((state) => state.openExternalFile);

  const openExternalHandles = useBufferStore(
    (state) => state.openExternalHandles,
  );

  const { files } = entries;

  // Alphabetical, so files stay put as they are opened.
  const savedTree = buildSavedTree(entries, (first, second) =>
    first.localeCompare(second),
  );

  const externalTargets: FileTarget[] = externalFiles
    .map((file): FileTarget => ({
      kind: "external",
      id: file.id,
      name: file.name,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));

  const folderTargets: FileMoveTarget[] = [
    { folder: "", label: "Lunarscribe" },
    ...allFolders(entries).map((folder) => ({ folder, label: folder })),
  ];

  // Keeps the time since each file was accessed current.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);

    return () => clearInterval(timer);
  }, []);

  useSearchShortcut(() => setIsSearchOpen(true));

  useEffect(() => {
    void runFileAction(
      async () => {
        setEntries(await listFiles());
      },
      "Unable to list files",
      "The saved file list could not be loaded.",
    );

    return onFilesChanged(setEntries);
  }, []);

  function openTarget(target: FileTarget) {
    return runFileAction(
      () =>
        target.kind === "saved"
          ? openFile(target.name)
          : openExternalFile(target.id),
      "Unable to open file",
      "The file could not be opened.",
    );
  }

  function openPickedFiles() {
    return runFileAction(
      async () => {
        const { handles, files } = await pickTextFiles();

        if (handles.length || files.length) {
          await openExternalHandles(handles, files);
        }

        if (files.length) {
          toast.add({
            type: "info",
            title: "Imported as saved notes",
            description:
              "This browser cannot save back to files on your device, so edits stay in Lunarscribe.",
          });
        }
      },
      "Unable to open file",
      "The file could not be opened.",
    );
  }

  /** Saved files live in browser storage, so this stands in for Copy path. */
  function downloadTarget(target: FileTarget) {
    return runFileAction(
      async () => {
        const content = await readFile(target.name);

        downloadBlob(
          new Blob([content], { type: "text/plain;charset=utf-8" }),
          target.name,
        );
      },
      "Unable to download file",
      "The file could not be downloaded.",
    );
  }

  function deleteTarget(target: FileTarget) {
    if (target.kind === "saved") {
      setDialog({ kind: "delete", target });

      return;
    }

    void runFileAction(
      () => removeExternalFile(target),
      "External file was not removed",
      "Changes could not be saved.",
    );
  }

  async function exportTarget(target: FileTarget, format: "PDF" | "DOCX") {
    setIsExporting(true);

    try {
      await runFileAction(
        async () => {
          const path = await (format === "PDF"
            ? exportPdf(target)
            : exportDocx(target));

          if (path) {
            toast.add({
              type: "success",
              title: `${format} exported`,
              description: <code>{path}</code>,
            });
          }
        },
        `Unable to export ${format}`,
        `The ${format} could not be saved.`,
      );
    } finally {
      setIsExporting(false);
    }
  }

  /** Overwrites the remote copy with the local one, or the local copy with the remote one. */
  async function forceSyncTarget(
    target: FileTarget,
    direction: "push" | "pull",
  ) {
    if (target.kind !== "saved" || isForcingSync) {
      return;
    }

    setIsForcingSync(true);

    try {
      await runFileAction(
        async () => {
          if (direction === "push") {
            await forceSyncFile(target.name);
          } else {
            await forcePullFile(target.name);
          }

          toast.add({
            type: "success",
            title:
              direction === "push"
                ? "Remote copy replaced"
                : "Local copy replaced",
            description: <code>{target.name}</code>,
          });
        },
        direction === "push"
          ? "Unable to force changes to remote"
          : "Unable to force changes from remote",
        direction === "push"
          ? "The remote copy could not be replaced."
          : "The local copy could not be replaced.",
      );
    } finally {
      setIsForcingSync(false);
    }
  }

  function moveTarget(name: string, folder: string) {
    void runFileAction(
      async () => {
        await moveFile(name, folder);

        if (folder) {
          setFolderOpen(folder, true);
        }
      },
      "Unable to move file",
      "The file could not be moved.",
    );
  }

  /** Starts a buffer that saves into `folder`, opening the folder so it shows there. */
  function createIn(kind: "markdown" | "drawing", folder: string) {
    createBuffer(kind, files, folder);

    if (folder) {
      setFolderOpen(folder, true);
    }
  }

  async function createFolder(parent: string, name: string) {
    await createSavedFolder(parent, name);

    if (parent) {
      setFolderOpen(parent, true);
    }
  }

  async function renameFolderTo(path: string, name: string) {
    const renamed = await renameFolder(path, name);

    if (renamed !== path && openFolders.includes(path)) {
      setFolderOpen(path, false);
      setFolderOpen(renamed, true);
    }
  }

  function changeMenu(key: string, open: boolean, anchor: HTMLElement | null) {
    setMenu((current) => {
      if (open) {
        return { key, anchor };
      }

      return current?.key === key ? null : current;
    });
  }

  function renderFileItem(target: FileTarget) {
    const key = fileKey(target);
    const accessedMs = accessedAt[key];

    const isActive =
      target.kind === "saved"
        ? target.name === activeBuffer?.fileName
        : target.id === activeBuffer?.externalId;

    return (
      <SidebarFileItem
        key={key}
        name={target.name}
        label={baseNameOf(target.name)}
        title={target.name}
        accessedLabel={
          accessedMs === undefined
            ? undefined
            : formatTimeAgo(accessedMs, nowMs)
        }
        isExternal={target.kind === "external"}
        dragPath={target.kind === "saved" ? target.name : undefined}
        canExport={isTextFile(target.name)}
        isActive={isActive}
        menu={menu?.key === key ? menu : null}
        onMenuChange={(open, anchor) => changeMenu(key, open, anchor)}
        onOpen={() => void openTarget(target)}
        onRename={() => setDialog({ kind: "rename", target })}
        moveTargets={
          target.kind === "saved"
            ? folderTargets.filter(
                ({ folder }) => folder !== folderOf(target.name),
              )
            : undefined
        }
        onMove={
          target.kind === "saved"
            ? (folder) => moveTarget(target.name, folder)
            : undefined
        }
        onDownload={
          target.kind === "saved"
            ? () => void downloadTarget(target)
            : undefined
        }
        onExportPdf={() => void exportTarget(target, "PDF")}
        onExportDocx={() => void exportTarget(target, "DOCX")}
        isExporting={isExporting}
        canForceSync={canForceSync && !isForcingSync}
        onForceSync={
          target.kind === "saved"
            ? () => void forceSyncTarget(target, "push")
            : undefined
        }
        onForcePull={
          target.kind === "saved"
            ? () => void forceSyncTarget(target, "pull")
            : undefined
        }
        onDelete={() => deleteTarget(target)}
      />
    );
  }

  const emptyMessage =
    savedTree.length === 0 && externalTargets.length === 0
      ? "No saved files yet. Start a note, drawing or folder above."
      : null;

  return (
    <>
      <Sidebar side="left">
        <AppSidebarHeader
          modKeyLabel={MOD_KEY_LABEL}
          onNewNote={() => createIn("markdown", "")}
          onOpenFile={() => void openPickedFiles()}
          onNewDrawing={() => createIn("drawing", "")}
          onNewFolder={() => setDialog({ kind: "new-folder", parent: "" })}
          renderSettings={(trigger) => (
            <SettingsDialog
              appearancePane={<AppearancePane />}
              syncingPane={<SyncingPane />}
            >
              {trigger}
            </SettingsDialog>
          )}
          onSearch={() => setIsSearchOpen(true)}
          onToggleTheme={toggleTheme}
        />
        <SidebarContent className="overflow-hidden">
          <SidebarFileList emptyMessage={emptyMessage}>
            <SidebarSavedFilesDropZone onMoveFile={moveTarget}>
              <SidebarMenu>
                <SidebarFolderTree
                  nodes={savedTree}
                  openFolders={new Set(openFolders)}
                  onFolderOpenChange={setFolderOpen}
                  menu={menu}
                  onMenuChange={changeMenu}
                  onMoveFile={moveTarget}
                  actions={{
                    onNewNote: (folder) => createIn("markdown", folder),
                    onNewDrawing: (folder) => createIn("drawing", folder),
                    onNewFolder: (parent) =>
                      setDialog({ kind: "new-folder", parent }),
                    onRename: (path) =>
                      setDialog({ kind: "rename-folder", path }),
                    onDelete: (path) =>
                      setDialog({ kind: "delete-folder", path }),
                  }}
                  renderFile={(file) =>
                    renderFileItem({ kind: "saved", name: file.path })
                  }
                />
                {externalTargets.map(renderFileItem)}
              </SidebarMenu>
            </SidebarSavedFilesDropZone>
          </SidebarFileList>
        </SidebarContent>
        {dialog?.kind === "rename" && (
          <RenameFileDialog
            key={fileKey(dialog.target)}
            name={dialog.target.name}
            initialTitle={stemOf(dialog.target.name)}
            onClose={() => setDialog(null)}
            onRename={(title) => renameFile(dialog.target, title)}
          />
        )}
        {dialog?.kind === "new-folder" && (
          <FolderNameDialog
            key={`new:${dialog.parent}`}
            title="New folder"
            description={
              dialog.parent
                ? `Create a folder inside “${baseNameOf(dialog.parent)}”.`
                : "Create a folder for saved files."
            }
            confirmLabel="Create"
            onClose={() => setDialog(null)}
            onConfirm={(name) => createFolder(dialog.parent, name)}
          />
        )}
        {dialog?.kind === "rename-folder" && (
          <FolderNameDialog
            key={`rename:${dialog.path}`}
            title="Rename folder"
            description={`Choose a new name for “${baseNameOf(dialog.path)}”.`}
            confirmLabel="Rename"
            initialName={baseNameOf(dialog.path)}
            onClose={() => setDialog(null)}
            onConfirm={(name) => renameFolderTo(dialog.path, name)}
          />
        )}
        {dialog?.kind === "delete-folder" && (
          <DeleteFolderDialog
            key={dialog.path}
            name={baseNameOf(dialog.path)}
            fileCount={
              files.filter((name) => isInFolder(name, dialog.path)).length
            }
            onClose={() => setDialog(null)}
            onDelete={() => deleteFolder(dialog.path)}
          />
        )}
        {dialog?.kind === "delete" && (
          <DeleteFileDialog
            key={fileKey(dialog.target)}
            name={dialog.target.name}
            onClose={() => setDialog(null)}
            onDelete={() => deleteFile(dialog.target.name)}
          />
        )}
        <SidebarResizeRail
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />
      </Sidebar>
      <FileSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        searchFiles={searchFiles}
        onFilesChanged={onFilesChanged}
        onOpenFile={openFile}
        lastOpenedAt={(name) => accessedAt[fileKey({ kind: "saved", name })]}
        externalFiles={externalFiles.map((file) => ({
          key: file.id,
          name: file.name,
          openedAt: accessedAt[fileKey({ kind: "external", ...file })],
        }))}
        onOpenExternalFile={openExternalFile}
        scopeDescription="Find up to 10 saved files in this browser and external files by name. Toggle Content to search inside saved files."
        scopeLabel="Up to 10 saved and external files"
      />
    </>
  );
}
