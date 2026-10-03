import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@lunarscribe/components/ui/dialog";
import { SidebarProvider } from "@lunarscribe/components/ui/sidebar";
import type { ReactNode } from "react";
import { useState } from "react";

import { AppearancePane } from "@/components/settings-dialog/appearance-pane";
import { SettingsSidebar } from "@/components/settings-dialog/settings-sidebar";
import type { SettingsSection } from "@/components/settings-dialog/settings-sidebar";
import { SyncingPane } from "@/components/settings-dialog/syncing-pane";

/** Settings window filling 80% of the Lunarscribe window: the settings sidebar beside the open section. */
export function SettingsDialog({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<SettingsSection>("appearances");

  return (
    <Dialog>
      {children}
      <DialogContent
        className="h-4/5 w-4/5 max-w-none sm:max-w-none"
        padded={false}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <SidebarProvider className="h-full min-h-0">
          <SettingsSidebar section={section} onSectionChange={setSection} />
          <div className="bg-background min-w-0 flex-1">
            {section === "appearances" ? <AppearancePane /> : <SyncingPane />}
          </div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
