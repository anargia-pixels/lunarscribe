import { FluidHighlight } from "@lunarscribe/components/fluid-motion/fluid-motion";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { DialogTrigger } from "@lunarscribe/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
} from "@lunarscribe/components/ui/sidebar";
import { toast } from "@lunarscribe/components/ui/toast";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { FilePlus, PenTool, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { DarkModeToggle } from "@/components/darkmode-toggle";
import { DeleteFileDialog } from "@/components/delete-file-dialog";
import { FileSearchDialog } from "@/components/file-search-dialog";
import { RenameFileDialog } from "@/components/rename-file-dialog";
import { SettingsDialog } from "@/components/settings-dialog/settings-dialog";
import { SidebarFileItem } from "@/components/sidebar-file-item";
import type { FileMenuState } from "@/components/sidebar-file-item";
import { SidebarFileSection } from "@/components/sidebar-file-section";
import type { FileTarget } from "@/lib/editor-files";
import { fileKey } from "@/lib/editor-files";
import { exportDocx } from "@/lib/export-docx";
import { exportPdf } from "@/lib/export-pdf";
import { runFileAction } from "@/lib/file-feedback";
import { FILE_SECTIONS } from "@/lib/sidebar-sections";
import { kindOf, useActiveBuffer, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

import "./app-sidebar.css";

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

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "e" ||
        !event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!event.repeat) {
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleSearchShortcut, true);

    return () =>
      window.removeEventListener("keydown", handleSearchShortcut, true);
  }, []);

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
        {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
        <TooltipProvider delay={800} timeout={300}>
          <SidebarHeader data-app-sidebar-header>
            <div>
              <div className="flex h-8 shrink-0 items-center justify-center gap-2 px-3">
                <h1 className="font-logo text-primary text-3xl">Lunarscribe</h1>
              </div>
              <div className="relative flex items-center justify-center gap-1 px-3 py-1.5">
                <FluidHighlight rows="button" className="bg-muted rounded-lg" />
                <Hint label="New note" side="bottom">
                  <Button
                    variant="fluid"
                    size="icon-sm"
                    aria-label="New note"
                    onClick={() => createBuffer("markdown", files)}
                  >
                    <FilePlus />
                  </Button>
                </Hint>
                <Hint label="New drawing" side="bottom">
                  <Button
                    variant="fluid"
                    size="icon-sm"
                    aria-label="New drawing"
                    onClick={() => createBuffer("drawing", files)}
                  >
                    <PenTool />
                  </Button>
                </Hint>
                <SettingsDialog>
                  <Hint label="Settings" side="bottom">
                    <DialogTrigger
                      render={
                        <Button
                          variant="fluid"
                          size="icon-sm"
                          aria-label="Settings"
                        />
                      }
                    >
                      <Settings />
                    </DialogTrigger>
                  </Hint>
                </SettingsDialog>
                <Hint
                  label="Search files"
                  side="bottom"
                  shortcut={["Ctrl", "E"]}
                >
                  <Button
                    variant="fluid"
                    size="icon-sm"
                    aria-label="Search files"
                    aria-keyshortcuts="Control+E"
                    aria-haspopup="dialog"
                    onClick={() => setIsSearchOpen(true)}
                  >
                    <Search />
                  </Button>
                </Hint>
                <DarkModeToggle />
              </div>
            </div>
          </SidebarHeader>
        </TooltipProvider>
        <SidebarContent className="overflow-hidden">
          {fileGroups.map((section) => (
            <SidebarFileSection
              key={section.section}
              section={section.section}
              label={section.label}
              count={section.files.length}
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
                      target={target}
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
                      onForceSync={() => void forceSyncTarget(target)}
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
      <FileSearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
