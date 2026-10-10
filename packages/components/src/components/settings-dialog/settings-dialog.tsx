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

/**
 * Settings window filling 80% of the Lunarscribe window: the settings sidebar beside the
 * open section. The About section shows only when `aboutPane` is given.
 */
export function SettingsDialog({
  appearancePane,
  syncingPane,
  aboutPane,
  children,
}: {
  appearancePane: ReactNode;
  syncingPane: ReactNode;
  aboutPane?: ReactNode;
  children: ReactNode;
}) {
  const panes: Record<SettingsSection, ReactNode> = {
    appearances: appearancePane,
    syncing: syncingPane,
    about: aboutPane,
  };

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
          <SettingsSidebar
            section={section}
            onSectionChange={setSection}
            hasAbout={aboutPane !== undefined}
          />
          <div className="bg-background min-w-0 flex-1">{panes[section]}</div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
