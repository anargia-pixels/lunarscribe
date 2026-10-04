import type { ThemeRevealOrigin } from "@lunarscribe/components/darkmode-toggle/darkmode-toggle";
import { DarkModeToggle } from "@lunarscribe/components/darkmode-toggle/darkmode-toggle";
import { FluidHighlight } from "@lunarscribe/components/fluid-motion/fluid-motion";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { DialogTrigger } from "@lunarscribe/components/ui/dialog";
import { SidebarHeader } from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { FilePlus, FolderOpen, PenTool, Search, Settings } from "lucide-react";
import type { ReactNode } from "react";

import "./app-sidebar-header.css";

/**
 * The Lunarscribe logo above the sidebar's action buttons. The settings button is a dialog
 * trigger, so `renderSettings` wraps it in the app's settings window. Open file shows only
 * when `onOpenFile` is given. Hovering the logo shows `version` when it is given.
 */
export function AppSidebarHeader({
  modKeyLabel,
  version,
  onNewNote,
  onOpenFile,
  onNewDrawing,
  renderSettings,
  onSearch,
  onToggleTheme,
}: {
  modKeyLabel: string;
  version?: string;
  onNewNote: () => void;
  onOpenFile?: () => void;
  onNewDrawing: () => void;
  renderSettings: (trigger: ReactNode) => ReactNode;
  onSearch: () => void;
  onToggleTheme: (origin: ThemeRevealOrigin) => void;
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
                <FilePlus />
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
                  <FolderOpen />
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
                <PenTool />
              </Button>
            </Hint>
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
                  <Settings />
                </DialogTrigger>
              </Hint>,
            )}
            <Hint label="Search files" side="bottom" shortcut={["Ctrl", "E"]}>
              <Button
                variant="fluid"
                size="icon-sm"
                aria-label="Search files"
                aria-keyshortcuts="Control+E"
                aria-haspopup="dialog"
                onClick={onSearch}
              >
                <Search />
              </Button>
            </Hint>
            <DarkModeToggle
              modKeyLabel={modKeyLabel}
              onToggle={onToggleTheme}
            />
          </div>
        </div>
      </SidebarHeader>
    </TooltipProvider>
  );
}
