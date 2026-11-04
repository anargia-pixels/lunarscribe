import {
  Download01Icon,
  FileAddIcon,
  FolderAddIcon,
  FolderOpenIcon,
  Loading03Icon,
  BrushIcon,
  RotateRight01Icon,
  Search01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ThemeRevealOrigin } from "@lunarscribe/components/darkmode-toggle/darkmode-toggle";
import { DarkModeToggle } from "@lunarscribe/components/darkmode-toggle/darkmode-toggle";
import { FluidHighlight } from "@lunarscribe/components/fluid-motion/fluid-motion";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { DialogTrigger } from "@lunarscribe/components/ui/dialog";
import { Separator } from "@lunarscribe/components/ui/separator";
import { SidebarHeader } from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import type { ReactNode } from "react";

import "./app-sidebar-header.css";

/** A newer release: `available` to download, `downloading`, then `ready` to restart. */
export type SidebarUpdate = {
  version: string;
  status: "available" | "downloading" | "ready";
  onClick: () => void;
};

function getUpdateLabel({ version, status }: SidebarUpdate) {
  if (status === "available") {
    return `Update to ${version}`;
  }

  return status === "downloading"
    ? `Downloading ${version}`
    : "Restart to update";
}

const UPDATE_ICONS = {
  available: <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />,
  downloading: (
    <HugeiconsIcon
      icon={Loading03Icon}
      strokeWidth={2}
      className="animate-spin"
    />
  ),
  ready: <HugeiconsIcon icon={RotateRight01Icon} strokeWidth={2} />,
} as const;

/** The update button, shown only while a newer release exists. */
function UpdateButton({ update }: { update: SidebarUpdate }) {
  const label = getUpdateLabel(update);

  return (
    <Hint label={label} side="bottom">
      <Button
        variant="fluid"
        size="icon-sm"
        aria-label={label}
        disabled={update.status === "downloading"}
        onClick={update.onClick}
      >
        {UPDATE_ICONS[update.status]}
      </Button>
    </Hint>
  );
}

/**
 * The Lunarscribe logo above the sidebar's action buttons. The settings button is a dialog
 * trigger, so `renderSettings` wraps it in the app's settings window. Open file shows only
 * when `onOpenFile` is given, and the update button when `update` is given. Hovering the
 * logo shows `version` when it is given.
 */
export function AppSidebarHeader({
  modKeyLabel,
  version,
  onNewNote,
  onOpenFile,
  onNewDrawing,
  onNewFolder,
  renderSettings,
  onSearch,
  onToggleTheme,
  update,
}: {
  modKeyLabel: string;
  version?: string;
  onNewNote: () => void;
  onOpenFile?: () => void;
  onNewDrawing: () => void;
  onNewFolder: () => void;
  renderSettings: (trigger: ReactNode) => ReactNode;
  onSearch: () => void;
  onToggleTheme: (origin: ThemeRevealOrigin) => void;
  update?: SidebarUpdate | null;
}) {
  const logo = <h1 className="font-logo text-primary text-3xl">Lunarscribe</h1>;

  return (
    // Hover waits 800ms; moving to a neighbour within 300ms opens it instantly.
    <TooltipProvider delay={800} timeout={300}>
      <SidebarHeader data-app-sidebar-header>
        <div>
          <div className="flex h-8 shrink-0 items-center justify-center gap-2 px-3">
            {version ? (
              <Hint label={`Version ${version}`} side="bottom">
                {logo}
              </Hint>
            ) : (
              logo
            )}
          </div>
          <div className="relative flex items-center justify-center gap-1 px-3 py-1.5">
            <FluidHighlight rows="button" className="bg-muted rounded-lg" />
            <Hint label="New note" side="bottom">
              <Button
                variant="fluid"
                size="icon-sm"
                aria-label="New note"
                onClick={onNewNote}
              >
                <HugeiconsIcon icon={FileAddIcon} strokeWidth={2} />
              </Button>
            </Hint>
            {onOpenFile && (
              <Hint label="Open file" side="bottom">
                <Button
                  variant="fluid"
                  size="icon-sm"
                  aria-label="Open file"
                  onClick={onOpenFile}
                >
                  <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} />
                </Button>
              </Hint>
            )}
            <Hint label="New drawing" side="bottom">
              <Button
                variant="fluid"
                size="icon-sm"
                aria-label="New drawing"
                onClick={onNewDrawing}
              >
                <HugeiconsIcon icon={BrushIcon} strokeWidth={2} />
              </Button>
            </Hint>
            <Hint label="New folder" side="bottom">
              <Button
                variant="fluid"
                size="icon-sm"
                aria-label="New folder"
                onClick={onNewFolder}
              >
                <HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} />
              </Button>
            </Hint>
            <Hint label="Search files" side="bottom" shortcut={["Ctrl", "E"]}>
              <Button
                variant="fluid"
                size="icon-sm"
                aria-label="Search files"
                aria-keyshortcuts="Control+E"
                aria-haspopup="dialog"
                onClick={onSearch}
              >
                <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
              </Button>
            </Hint>
            <Separator orientation="vertical" className="mx-1 my-1.5" />
            {renderSettings(
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
                  <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                </DialogTrigger>
              </Hint>,
            )}
            <DarkModeToggle
              modKeyLabel={modKeyLabel}
              onToggle={onToggleTheme}
            />
            {update && <UpdateButton update={update} />}
          </div>
        </div>
      </SidebarHeader>
    </TooltipProvider>
  );
}
