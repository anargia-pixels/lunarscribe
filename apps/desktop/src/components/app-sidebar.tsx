import { ConfirmationDialog } from "@lunarscribe/components/confirmation-dialog/confirmation-dialog";
import { FluidHighlight } from "@lunarscribe/components/fluid-motion/fluid-motion";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@lunarscribe/components/ui/collapsible";
import { DialogTrigger } from "@lunarscribe/components/ui/dialog";
import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { ChevronDown, FilePlus, PenTool, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { DarkModeToggle } from "@/components/darkmode-toggle";
import { SettingsDialog } from "@/components/settings-dialog/settings-dialog";
import {
  kindOf,
  stemOf,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { SidebarSection } from "@/stores/sidebar-store";

/** Sidebar groups for saved buffers and tracked external files. */
export function AppSidebar() {
  const [files, setFiles] = useState<string[]>([]);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const openFile = useBufferStore((state) => state.openFile);
  const createBuffer = useBufferStore((state) => state.createBuffer);
  const deleteFile = useBufferStore((state) => state.deleteFile);
  const activeBuffer = useActiveBuffer();
  const externalFiles = useBufferStore((state) => state.externalFiles);
  const openExternalFiles = useBufferStore((state) => state.openExternalFiles);

  const fileGroups = [
    {
      section: "notes",
      label: "Notes",
      files: files.filter((name) => kindOf(name) === "markdown"),
    },
    {
      section: "drawings",
      label: "Drawings",
      files: files.filter((name) => kindOf(name) === "drawing"),
    },
  ] satisfies { section: SidebarSection; label: string; files: string[] }[];

  useEffect(() => {
    void window.lunarscribe.listFiles().then(setFiles);

    return window.lunarscribe.onFilesChanged(setFiles);
  }, []);

  async function confirmDelete() {
    if (!fileToDelete || !deleteDialogOpen || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteFile(fileToDelete);
      setDeleteDialogOpen(false);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Unable to delete the file.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Sidebar>
      {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
      <TooltipProvider delay={800} timeout={300}>
        <SidebarHeader>
          <div className="flex h-8 shrink-0 items-center justify-center px-3">
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
            <DarkModeToggle />
          </div>
        </SidebarHeader>
      </TooltipProvider>
      <SidebarContent className="overflow-hidden">
        {fileGroups.map((group) => (
          <SidebarFileSection
            key={group.section}
            section={group.section}
            label={group.label}
            count={group.files.length}
          >
            <SidebarMenu>
              {group.files.map((name) => (
                <SidebarMenuItem key={name} className="overflow-clip">
                  <SidebarMenuButton
                    size="compact"
                    isActive={name === activeBuffer?.fileName}
                    onClick={() => void openFile(name)}
                  >
                    <span>{stemOf(name)}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    render={<Button variant="destructive" size="icon-xs" />}
                    showOnHover
                    aria-label={`Delete ${name}`}
                    onClick={() => {
                      setFileToDelete(name);
                      setDeleteError(null);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarFileSection>
        ))}
        <SidebarFileSection
          section="external-files"
          label="External files"
          count={externalFiles.length}
        >
          <SidebarMenu>
            {externalFiles.map((file) => (
              <SidebarMenuItem key={file.path} className="overflow-clip">
                <SidebarMenuButton
                  size="compact"
                  isActive={file.path === activeBuffer?.externalPath}
                  title={file.path}
                  onClick={() => void openExternalFiles([file.path])}
                >
                  <span>{file.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarFileSection>
      </SidebarContent>
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete file?"
        description={`Are you sure you want to delete “${fileToDelete ?? ""}”? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        pending={isDeleting}
        error={deleteError}
      />
    </Sidebar>
  );
}

/** Each expanded section shares the available height and scrolls below its fixed label. */
function SidebarFileSection({
  section,
  label,
  count,
  children,
}: {
  section: SidebarSection;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const open = useSidebarStore((state) => state.sectionsOpen[section] ?? true);
  const setSectionOpen = useSidebarStore((state) => state.setSectionOpen);

  return (
    <Collapsible
      variant="section"
      open={open}
      onOpenChange={(nextOpen) => setSectionOpen(section, nextOpen)}
      className="group/section flex min-h-14 shrink-0 grow-0 basis-14 flex-col data-open:grow"
    >
      <SidebarGroup className="min-h-0 flex-1">
        <SidebarGroupLabel
          render={<CollapsibleTrigger variant="section" aria-label={label} />}
          className="h-10 w-full justify-start"
        >
          <span>
            {label}({count})
          </span>
          <ChevronDown className="ml-auto transition-transform duration-200 ease-out group-data-closed/section:-rotate-90 motion-reduce:transition-none" />
        </SidebarGroupLabel>
        <CollapsibleContent
          variant="section"
          keepMounted
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ScrollArea
            render={<section />}
            aria-label={label}
            className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
          >
            {children}
          </ScrollArea>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
