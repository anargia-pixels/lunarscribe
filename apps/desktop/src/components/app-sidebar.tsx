import { DeleteFileDialog } from "@lunarscribe/components/file-dialog/delete-file-dialog";
import { RenameFileDialog } from "@lunarscribe/components/file-dialog/rename-file-dialog";
import { useSearchShortcut } from "@lunarscribe/components/hooks/use-search-shortcut";
import { runFileAction } from "@lunarscribe/components/lib/file-feedback";
import { FileSearchDialog } from "@lunarscribe/components/search/file-search-dialog";
import { SettingsDialog } from "@lunarscribe/components/settings-dialog/settings-dialog";
import { AppSidebarHeader } from "@lunarscribe/components/sidebar/app-sidebar-header";
import { SidebarFileItem } from "@lunarscribe/components/sidebar/sidebar-file-item";
import type { FileMenuState } from "@lunarscribe/components/sidebar/sidebar-file-item";
import { SidebarFileSection } from "@lunarscribe/components/sidebar/sidebar-file-section";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
} from "@lunarscribe/components/ui/sidebar";
import { toast } from "@lunarscribe/components/ui/toast";
import { FILE_SECTIONS } from "@lunarscribe/utils/sidebar-sections";
import { useEffect, useState } from "react";

import { AppearancePane } from "@/components/settings-dialog/appearance-pane";
import { SyncingPane } from "@/components/settings-dialog/syncing-pane";
import { useTheme } from "@/components/theme-provider";
import type { FileTarget } from "@/lib/editor-files";
import { fileKey, isTextFile } from "@/lib/editor-files";
import { exportDocx } from "@/lib/export-docx";
import { exportPdf } from "@/lib/export-pdf";
import {
  kindOf,
  stemOf,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useSyncStore } from "@/stores/sync-store";

type FileDialogState =
  | { kind: "rename"; target: FileTarget }
  | { kind: "delete"; target: Extract<FileTarget, { kind: "saved" }> };

/** Sidebar groups for saved buffers and tracked external files. */
export function AppSidebar() {
  const [files, setFiles] = useState<string[]>([]);
  const [dialog, setDialog] = useState<FileDialogState | null>(null);
  const [menu, setMenu] = useState<FileMenuState | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isForcingSync, setIsForcingSync] = useState(false);

  const canForceSync = useSyncStore(
    (state) => state.provider !== null && !state.busy && !state.needsSignIn,
  );

  const openFile = useBufferStore((state) => state.openFile);
  const createBuffer = useBufferStore((state) => state.createBuffer);
  const deleteFile = useBufferStore((state) => state.deleteFile);
  const renameFile = useBufferStore((state) => state.renameFile);
  const forceSyncFile = useBufferStore((state) => state.forceSyncFile);

  const removeExternalFile = useBufferStore(
    (state) => state.removeExternalFile,
  );

  const sectionsOpen = useSidebarStore((state) => state.sectionsOpen);
  const setSectionOpen = useSidebarStore((state) => state.setSectionOpen);
  const { toggleTheme } = useTheme();

  const activeBuffer = useActiveBuffer();
  const externalFiles = useBufferStore((state) => state.externalFiles);

  const openExternalFiles = useBufferStore((state) => state.openExternalFiles);

  const fileGroups = FILE_SECTIONS.map((section) => {
    const targets: FileTarget[] =
      section.kind === "external"
        ? externalFiles.map((file) => ({
            kind: "external",
            path: file.path,
            name: file.name,
          }))
        : [];

    return { ...section, files: targets };
  });

  for (const name of files) {
    const kind = kindOf(name);
    const group = fileGroups.find((section) => section.kind === kind);
    group?.files.push({ kind: "saved", name });
  }

  useSearchShortcut(() => setIsSearchOpen(true));

  useEffect(() => {
    void runFileAction(
      async () => {
        setFiles(await window.lunarscribe.listFiles());
      },
      "Unable to list files",
      "The saved file list could not be loaded.",
    );

    return window.lunarscribe.onFilesChanged(setFiles);
  }, []);

  function openTarget(target: FileTarget) {
    return runFileAction(
      () =>
        target.kind === "saved"
          ? openFile(target.name)
          : openExternalFiles([target.path]),
      "Unable to open file",
      "The file could not be opened.",
    );
  }

  function copyPath(target: FileTarget) {
    return runFileAction(
      async () => {
        const path =
          target.kind === "external"
            ? target.path
            : await window.lunarscribe.getFilePath(target.name);

        await navigator.clipboard.writeText(path);
        toast.add({
          type: "success",
          title: "Path copied",
          description: <code>{path}</code>,
        });
      },
      "Unable to copy path",
      "The path could not be copied.",
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

  async function forceSyncTarget(target: FileTarget) {
    if (target.kind !== "saved" || isForcingSync) {
      return;
    }

    setIsForcingSync(true);

    try {
      await runFileAction(
        async () => {
          await forceSyncFile(target.name);
          toast.add({
            type: "success",
            title: "Remote copy replaced",
            description: <code>{target.name}</code>,
          });
        },
        "Unable to force changes to remote",
        "The remote copy could not be replaced.",
      );
    } finally {
      setIsForcingSync(false);
    }
  }

  return (
    <>
      <Sidebar>
        <AppSidebarHeader
          modKeyLabel={window.lunarscribe.platform === "darwin" ? "⌘" : "Ctrl"}
          version={__APP_VERSION__}
          onNewNote={() => createBuffer("markdown", files)}
          onNewDrawing={() => createBuffer("drawing", files)}
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
          {fileGroups.map((section) => (
            <SidebarFileSection
              key={section.section}
              label={section.label}
              count={section.files.length}
              open={sectionsOpen[section.section]}
              onOpenChange={(open) => setSectionOpen(section.section, open)}
            >
              <SidebarMenu>
                {section.files.map((target) => {
                  const key = fileKey(target);

                  const isActive =
                    target.kind === "saved"
                      ? target.name === activeBuffer?.fileName
                      : target.path === activeBuffer?.externalPath;

                  return (
                    <SidebarFileItem
                      key={key}
                      name={target.name}
                      label={
                        target.kind === "external"
                          ? target.name
                          : stemOf(target.name)
                      }
                      title={
                        target.kind === "external" ? target.path : target.name
                      }
                      isExternal={target.kind === "external"}
                      canExport={isTextFile(target.name)}
                      isActive={isActive}
                      menu={menu?.key === key ? menu : null}
                      onMenuChange={(open, anchor) =>
                        setMenu((current) => {
                          if (open) {
                            return { key, anchor };
                          }

                          return current?.key === key ? null : current;
                        })
                      }
                      onOpen={() => void openTarget(target)}
                      onRename={() => setDialog({ kind: "rename", target })}
                      onCopyPath={() => void copyPath(target)}
                      onExportPdf={() => void exportTarget(target, "PDF")}
                      onExportDocx={() => void exportTarget(target, "DOCX")}
                      isExporting={isExporting}
                      canForceSync={canForceSync && !isForcingSync}
                      onForceSync={
                        target.kind === "saved"
                          ? () => void forceSyncTarget(target)
                          : undefined
                      }
                      onDelete={() => deleteTarget(target)}
                    />
                  );
                })}
              </SidebarMenu>
            </SidebarFileSection>
          ))}
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
        {dialog?.kind === "delete" && (
          <DeleteFileDialog
            key={fileKey(dialog.target)}
            name={dialog.target.name}
            onClose={() => setDialog(null)}
            onDelete={() => deleteFile(dialog.target.name)}
          />
        )}
      </Sidebar>
      <FileSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        searchFiles={window.lunarscribe.searchFiles}
        onFilesChanged={window.lunarscribe.onFilesChanged}
        onOpenFile={openFile}
        isDrawing={(name) => kindOf(name) === "drawing"}
        scopeDescription="Find up to 10 saved files in lunarscribe. Toggle Content to search inside files."
        scopeLabel="Up to 10 files in lunarscribe"
      />
    </>
  );
}
