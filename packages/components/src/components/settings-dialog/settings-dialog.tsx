import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@lunarscribe/components/ui/dialog";
import { SidebarProvider } from "@lunarscribe/components/ui/sidebar";
import type { ReactNode } from "react";
import { useState } from "react";

import { SettingsSidebar } from "./settings-sidebar";
import type { SettingsSection } from "./settings-sidebar";

/** Settings window filling 80% of the Lunarscribe window: the settings sidebar beside the open section. */
export function SettingsDialog({
  appearancePane,
  syncingPane,
  children,
}: {
  appearancePane: ReactNode;
  syncingPane: ReactNode;
  children: ReactNode;
}) {
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
            {section === "appearances" ? appearancePane : syncingPane}
          </div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
