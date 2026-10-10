import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@lunarscribe/components/ui/sidebar";
import { Info, Palette, RefreshCw } from "lucide-react";

export type SettingsSection = "appearances" | "syncing" | "about";

/**
 * Settings navigation listing the sections of the settings window; it never collapses.
 * About is listed only when `hasAbout` is set.
 */
export function SettingsSidebar({
  section,
  onSectionChange,
  hasAbout,
}: {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  hasAbout: boolean;
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
            {hasAbout && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={section === "about"}
                  onClick={() => onSectionChange("about")}
                >
                  <Info />
                  <span>About</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
