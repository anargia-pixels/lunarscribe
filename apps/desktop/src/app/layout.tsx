import {
  SidebarInset,
  SidebarProvider,
} from "@lunarscribe/components/ui/sidebar";
import { Toaster, toast } from "@lunarscribe/components/ui/toast";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { useBufferStore } from "@/stores/buffer-store";
import { useSidebarStore } from "@/stores/sidebar-store";

/** App shell shared by every page: sidebar on the left, page content in the inset. */
export default function RootLayout({ children }: { children: ReactNode }) {
  const sidebarOpen = useSidebarStore((state) => state.open);
  const setSidebarOpen = useSidebarStore((state) => state.setOpen);

  useEffect(() => {
    const handleSaveShortcut = async (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "s" ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.repeat) {
        return;
      }

      try {
        const fileName = await useBufferStore.getState().saveActiveBuffer();

        toast.add({
          type: "success",
          title: "File saved",
          description: fileName,
        });
      } catch (error) {
        toast.add({
          type: "error",
          title: "Unable to save file",
          description:
            error instanceof Error
              ? error.message
              : "The file could not be saved.",
        });
      }
    };

    // Capture the shortcut before an editor can handle it as an export or browser save.
    window.addEventListener("keydown", handleSaveShortcut, true);

    return () =>
      window.removeEventListener("keydown", handleSaveShortcut, true);
  }, []);

  return (
    <ThemeProvider>
      <Toaster>
        <TooltipProvider>
          <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </Toaster>
    </ThemeProvider>
  );
}
