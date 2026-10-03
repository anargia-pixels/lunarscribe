import {
  SidebarInset,
  SidebarProvider,
} from "@lunarscribe/components/ui/sidebar";
import { Toaster } from "@lunarscribe/components/ui/toast";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { useSaveShortcut } from "@/components/use-save-shortcut";
import { useSync } from "@/components/use-sync";
import { useSidebarStore } from "@/stores/sidebar-store";

/** App shell shared by every page: sidebar on the left, page content in the inset. */
export default function RootLayout({ children }: { children: ReactNode }) {
  const sidebarOpen = useSidebarStore((state) => state.open);
  const setSidebarOpen = useSidebarStore((state) => state.setOpen);

  useSaveShortcut();
  useSync();

  return (
    <ThemeProvider>
      <Toaster>
        <TooltipProvider>
          <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <AppSidebar />
            <SidebarInset className="min-w-0">{children}</SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </Toaster>
    </ThemeProvider>
  );
}
