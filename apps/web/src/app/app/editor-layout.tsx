import {
  SidebarInset,
  SidebarProvider,
} from "@lunarscribe/components/ui/sidebar";
import { Toaster } from "@lunarscribe/components/ui/toast";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { Outlet } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { useSidebarStore } from "@/stores/sidebar-store";

import { AppSidebar } from "./app-sidebar";
import { ThemeProvider } from "./theme-provider";
import { useSaveShortcut } from "./use-save-shortcut";
import { useSync } from "./use-sync";

/** The editor's shell: sidebar on the left, the page in the inset. */
export default function EditorLayout() {
  const sidebarOpen = useSidebarStore((state) => state.open);
  const setSidebarOpen = useSidebarStore((state) => state.setOpen);
  const sidebarWidth = useSidebarStore((state) => state.width);

  const sidebarStyle: CSSProperties & Record<"--sidebar-width", string> = {
    "--sidebar-width": `${sidebarWidth}px`,
  };

  useSaveShortcut();
  useSync();

  return (
    <ThemeProvider>
      <Toaster>
        <TooltipProvider>
          <SidebarProvider
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            style={sidebarStyle}
          >
            <AppSidebar />
            <SidebarInset className="min-w-0">
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </Toaster>
    </ThemeProvider>
  );
}
