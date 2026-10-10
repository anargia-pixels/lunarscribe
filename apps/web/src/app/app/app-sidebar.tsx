import { DeleteFileDialog } from "@lunarscribe/components/file-dialog/delete-file-dialog";
import { RenameFileDialog } from "@lunarscribe/components/file-dialog/rename-file-dialog";
import { useSearchShortcut } from "@lunarscribe/components/hooks/use-search-shortcut";
import { runFileAction } from "@lunarscribe/components/lib/file-feedback";
import { FileSearchDialog } from "@lunarscribe/components/search/file-search-dialog";
import { SettingsDialog } from "@lunarscribe/components/settings-dialog/settings-dialog";
import { AppSidebarHeader } from "@lunarscribe/components/sidebar/app-sidebar-header";
import { SidebarFileItem } from "@lunarscribe/components/sidebar/sidebar-file-item";
import type { FileMenuState } from "@lunarscribe/components/sidebar/sidebar-file-item";
import {
  FILE_SECTION_ICONS,
  SidebarFileTabs,
} from "@lunarscribe/components/sidebar/sidebar-file-tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
} from "@lunarscribe/components/ui/sidebar";
import { toast } from "@lunarscribe/components/ui/toast";
import {
  FILE_SECTIONS,
  isSidebarSection,
} from "@lunarscribe/utils/sidebar-sections";
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
import { listFiles, onFilesChanged, readFile } from "@/lib/saved-files";
import {
  kindOf,
  stemOf,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";
import { useFileAccessStore } from "@/stores/file-access-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useSyncStore } from "@/stores/sync-store";

import { AppearancePane } from "./settings-dialog/appearance-pane";
import { SyncingPane } from "./settings-dialog/syncing-pane";
import { SidebarResizeRail } from "./sidebar-resize-rail";
import { useTheme } from "./theme-provider";

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
  const [nowMs, setNowMs] = useState(Date.now);
  const accessedAt = useFileAccessStore((state) => state.accessedAt);

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

  const activeSection = useSidebarStore((state) => state.section);
  const setSection = useSidebarStore((state) => state.setSection);
  const { toggleTheme } = useTheme();

  const activeBuffer = useActiveBuffer();
  const externalFiles = useBufferStore((state) => state.externalFiles);

  const openExternalFile = useBufferStore((state) => state.openExternalFile);

  const openExternalHandles = useBufferStore(
    (state) => state.openExternalHandles,
  );

  const fileGroups = FILE_SECTIONS.map((section) => {
    const targets: FileTarget[] =
      section.kind === "external"
        ? externalFiles.map((file) => ({
            kind: "external",
            id: file.id,
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

  // Most recently accessed first; files never opened here follow by name.
  for (const group of fileGroups) {
    group.files.sort(
      (first, second) =>
        (accessedAt[fileKey(second)] ?? 0) -
          (accessedAt[fileKey(first)] ?? 0) ||
        first.name.localeCompare(second.name),
    );
  }

  // Keeps the time since each file was accessed current.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);

    return () => clearInterval(timer);
  }, []);

  useSearchShortcut(() => setIsSearchOpen(true));

  useEffect(() => {
    void runFileAction(
      async () => {
        setFiles(await listFiles());
      },
      "Unable to list files",
      "The saved file list could not be loaded.",
    );

    return onFilesChanged(setFiles);
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
          modKeyLabel={MOD_KEY_LABEL}
          onNewNote={() => createBuffer("markdown", files)}
          onOpenFile={() => void openPickedFiles()}
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
          <SidebarFileTabs
            value={activeSection}
            onValueChange={(section) => {
              if (isSidebarSection(section)) {
                setSection(section);
              }
            }}
            tabs={fileGroups.map((section) => ({
              value: section.section,
              label: section.label,
              shortLabel: section.shortLabel,
              icon: FILE_SECTION_ICONS[section.section],
              count: section.files.length,
              content: (
                <SidebarMenu>
                  {section.files.map((target) => {
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
                        label={
                          target.kind === "external"
                            ? target.name
                            : stemOf(target.name)
                        }
                        title={target.name}
                        accessedLabel={
                          accessedMs === undefined
                            ? undefined
                            : formatTimeAgo(accessedMs, nowMs)
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
                            ? () => void forceSyncTarget(target)
                            : undefined
                        }
                        onDelete={() => deleteTarget(target)}
                      />
                    );
                  })}
                </SidebarMenu>
              ),
            }))}
          />
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
        <SidebarResizeRail />
      </Sidebar>
      <FileSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        searchFiles={searchFiles}
        onFilesChanged={onFilesChanged}
        onOpenFile={openFile}
        isDrawing={(name) => kindOf(name) === "drawing"}
        scopeDescription="Find up to 10 saved files in this browser. Toggle Content to search inside files."
        scopeLabel="Up to 10 saved files"
      />
    </>
  );
}
