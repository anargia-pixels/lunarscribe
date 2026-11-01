/** The sidebar's tabs: saved files in the lunarscribe folder, and tracked external files. */
export const FILE_SECTIONS = [
  {
    section: "lunarscribe",
    label: "Lunarscribe",
    shortLabel: "Lunarscribe",
    kind: "saved",
  },
  {
    section: "external-files",
    label: "External files",
    shortLabel: "External",
    kind: "external",
  },
] as const;

export type SidebarSection = (typeof FILE_SECTIONS)[number]["section"];

/** Validate section keys from persisted state before merging them with current defaults. */
export function isSidebarSection(section: string): section is SidebarSection {
  return FILE_SECTIONS.some((candidate) => candidate.section === section);
}
