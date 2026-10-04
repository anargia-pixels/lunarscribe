import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@lunarscribe/components/ui/sidebar";
import { Palette, RefreshCw } from "lucide-react";

export type SettingsSection = "appearances" | "syncing";

/** Settings navigation listing the sections of the settings window; it never collapses. */
export function SettingsSidebar({
  section,
  onSectionChange,
}: {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}) {
  return (
    <Sidebar collapsible="none">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "appearances"}
                onClick={() => onSectionChange("appearances")}
              >
                <Palette />
                <span>Appearances</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "syncing"}
                onClick={() => onSectionChange("syncing")}
              >
                <RefreshCw />
                <span>Syncing</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
