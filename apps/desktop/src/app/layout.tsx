import { DevTools } from "@lunarscribe/components/dev-tools/dev-tools";
import {
  SidebarInset,
  SidebarProvider,
} from "@lunarscribe/components/ui/sidebar";
import { Toaster } from "@lunarscribe/components/ui/toast";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import type { CSSProperties, ReactNode } from "react";

import { AppOutlineSidebar } from "@/components/app-outline-sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { useFileWatcher } from "@/components/use-file-watcher";
import { useOutlineShortcut } from "@/components/use-outline-shortcut";
import { useSaveShortcut } from "@/components/use-save-shortcut";
import { useSync } from "@/components/use-sync";
import { useZoomShortcut } from "@/components/use-zoom-shortcut";
import { useSidebarStore } from "@/stores/sidebar-store";

/** App shell shared by every page: sidebar on the left, page content in the inset, outline on the right. */
export default function RootLayout({ children }: { children: ReactNode }) {
  const sidebarOpen = useSidebarStore((state) => state.open);
  const setSidebarOpen = useSidebarStore((state) => state.setOpen);
  const sidebarWidth = useSidebarStore((state) => state.width);

  const sidebarStyle: CSSProperties & Record<"--sidebar-width", string> = {
    "--sidebar-width": `${sidebarWidth}px`,
  };

  useFileWatcher();
  useOutlineShortcut();
  useSaveShortcut();
  useSync();
  useZoomShortcut();

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
            <SidebarInset className="min-w-0 flex-row">
              <div className="flex min-w-0 flex-1 flex-col">{children}</div>
              <AppOutlineSidebar />
            </SidebarInset>
          </SidebarProvider>
          {import.meta.env.DEV && <DevTools />}
        </TooltipProvider>
      </Toaster>
    </ThemeProvider>
  );
}
