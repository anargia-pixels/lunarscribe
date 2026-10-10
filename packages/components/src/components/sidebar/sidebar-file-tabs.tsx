import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import {
  TabItem,
  TabPanel,
  Tabs,
  TabsList,
} from "@lunarscribe/components/ui/tabs";
import type { SidebarSection } from "@lunarscribe/utils/sidebar-sections";
import { FileText, FolderOpen, PenTool } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** Tab list width, in CSS px, below which the labels give way to icons (17rem). */
const ICON_MODE_WIDTH = 272;

/** Tab icons, matching the header's new note, new drawing and open buttons. */
export const FILE_SECTION_ICONS: Record<SidebarSection, LucideIcon> = {
  notes: FileText,
  drawings: PenTool,
  "external-files": FolderOpen,
};

export type SidebarFileTab = {
  value: string;
  label: string;
  /** Fits a tab; `label` shows on hover. */
  shortLabel: string;
  /** Replaces `shortLabel` when the sidebar is too narrow for the labels. */
  icon: LucideIcon;
  count: number;
  content: ReactNode;
};

/**
 * One tab per file kind; only the selected tab's files show, scrolling below the tabs.
 * Below 17rem the tabs swap their labels for icons, keeping the full label as the tooltip.
 */
export function SidebarFileTabs({
  tabs,
  value,
  onValueChange,
}: {
  tabs: readonly SidebarFileTab[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [isIconMode, setIsIconMode] = useState(false);

  useEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setIsIconMode((entry?.contentRect.width ?? 0) < ICON_MODE_WIDTH);
    });

    observer.observe(list);

    return () => observer.disconnect();
  }, []);

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div ref={listRef} className="px-2 pb-2">
        <TabsList className="flex w-full">
          {tabs.map((tab) => (
            <TabItem
              key={tab.value}
              value={tab.value}
              title={tab.label}
              icon={isIconMode ? tab.icon : undefined}
              label={
                isIconMode
                  ? String(tab.count)
                  : `${tab.shortLabel} ${tab.count}`
              }
              className="min-w-0 flex-1 justify-center"
            />
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabPanel
          key={tab.value}
          value={tab.value}
          className="flex min-h-0 flex-1 flex-col"
        >
          <ScrollArea
            render={<section />}
            aria-label={tab.label}
            className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
          >
            {tab.count > 0 ? (
              // Matches the tab list's inset so items line up with it.
              <div className="px-2">{tab.content}</div>
            ) : (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                {`No ${tab.label.toLowerCase()} yet.`}
              </p>
            )}
          </ScrollArea>
        </TabPanel>
      ))}
    </Tabs>
  );
}
