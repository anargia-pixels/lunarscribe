import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@lunarscribe/components/ui/breadcrumb";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@lunarscribe/components/ui/dialog";
import { SidebarProvider } from "@lunarscribe/components/ui/sidebar";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  SETTINGS_SECTION_LABELS,
  SettingsSidebar,
  type SettingsSection,
} from "./settings-sidebar";

/**
 * Settings window filling 80% of the Lunarscribe window: the settings sidebar
 * beside the open section, under a bar naming that section with a close button.
 * The About section shows only when `aboutPane` is given.
 */
export function SettingsDialog({
  appearancePane,
  syncingPane,
  storagePane,
  aboutPane,
  children,
}: {
  appearancePane: ReactNode;
  syncingPane: ReactNode;
  storagePane: ReactNode;
  aboutPane?: ReactNode;
  children: ReactNode;
}) {
  const panes: Record<SettingsSection, ReactNode> = {
    appearances: appearancePane,
    syncing: syncingPane,
    storage: storagePane,
    about: aboutPane,
  };

  const [section, setSection] = useState<SettingsSection>("appearances");

  return (
    <Dialog>
      {children}
      <DialogContent
        className="h-4/5 w-4/5 max-w-none sm:max-w-none"
        padded={false}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <SidebarProvider className="h-full min-h-0" data-nested-sidebar>
          <SettingsSidebar
            section={section}
            onSectionChange={setSection}
            hasAbout={aboutPane !== undefined}
          />
          <div className="bg-background flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>Settings</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {SETTINGS_SECTION_LABELS[section]}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close settings"
                  />
                }
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </DialogClose>
            </header>
            {/* Keyed so each section opens at its top. */}
            <div key={section} className="min-h-0 flex-1">
              {panes[section]}
            </div>
          </div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
