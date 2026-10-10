/** The sidebar's section labels, short tab labels and the kinds of files each section contains. */
export const FILE_SECTIONS = [
  { section: "notes", label: "Notes", shortLabel: "Notes", kind: "markdown" },
  {
    section: "drawings",
    label: "Drawings",
    shortLabel: "Drawings",
    kind: "drawing",
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
