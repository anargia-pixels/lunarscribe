import {
  SidebarInset,
  SidebarProvider,
} from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { useSidebarStore } from "@/stores/sidebar-store";

/** App shell shared by every page: sidebar on the left, page content in the inset. */
export default function RootLayout({ children }: { children: ReactNode }) {
  const sidebarOpen = useSidebarStore((state) => state.open);
  const setSidebarOpen = useSidebarStore((state) => state.setOpen);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
