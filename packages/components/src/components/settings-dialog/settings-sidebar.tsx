import {
  Database01Icon,
  InformationCircleIcon,
  PaintBoardIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@lunarscribe/components/ui/sidebar";

export type SettingsSection = "appearances" | "syncing" | "storage" | "about";

type SectionLink = {
  section: SettingsSection;
  label: string;
  icon: IconSvgElement;
};

/** Each section's name, used in the settings sidebar and the settings window's breadcrumb. */
export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  appearances: "Appearance",
  syncing: "Syncing",
  storage: "Storage",
  about: "About",
};

const GROUPS: { label: string; links: SectionLink[] }[] = [
  {
    label: "Personalize",
    links: [
      {
        section: "appearances",
        label: SETTINGS_SECTION_LABELS.appearances,
        icon: PaintBoardIcon,
      },
    ],
  },
  {
    label: "Data",
    links: [
      {
        section: "syncing",
        label: SETTINGS_SECTION_LABELS.syncing,
        icon: RefreshIcon,
      },
      {
        section: "storage",
        label: SETTINGS_SECTION_LABELS.storage,
        icon: Database01Icon,
      },
    ],
  },
];

function SectionButton({
  link,
  isActive,
  onSectionChange,
}: {
  link: SectionLink;
  isActive: boolean;
  onSectionChange: (section: SettingsSection) => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onSectionChange(link.section)}
      >
        <HugeiconsIcon icon={link.icon} strokeWidth={2} />
        <span>{link.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Settings navigation listing the sections of the settings window in labelled
 * groups, with About at the bottom; it never collapses. About is listed only
 * when `hasAbout` is set.
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
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.links.map((link) => (
                <SectionButton
                  key={link.section}
                  link={link}
                  isActive={section === link.section}
                  onSectionChange={onSectionChange}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {hasAbout && (
        <SidebarFooter>
          <SidebarMenu>
            <SectionButton
              link={{
                section: "about",
                label: SETTINGS_SECTION_LABELS.about,
                icon: InformationCircleIcon,
              }}
              isActive={section === "about"}
              onSectionChange={onSectionChange}
            />
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
