import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@lunarscribe/components/ui/dialog";
import { SidebarProvider } from "@lunarscribe/components/ui/sidebar";
import type { ReactNode } from "react";

import { SettingsSidebar } from "@/components/settings-dialog/settings-sidebar";

/** Settings window filling 80% of the Lunarscribe window: the settings sidebar beside the open section. */
export function SettingsDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      {children}
      <DialogContent
        className="h-4/5 w-4/5 max-w-none sm:max-w-none"
        padded={false}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <SidebarProvider className="h-full min-h-0">
          <SettingsSidebar />
          <div className="bg-background min-w-0 flex-1" />
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
