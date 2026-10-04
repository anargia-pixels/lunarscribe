import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@lunarscribe/components/ui/collapsible";
import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import {
  SidebarGroup,
  SidebarGroupLabel,
} from "@lunarscribe/components/ui/sidebar";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import "./sidebar-file-section.css";

/** Each expanded section shares the available height and scrolls below its fixed label. */
export function SidebarFileSection({
  label,
  count,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      data-sidebar-file-section
      className="group/section flex min-h-14 shrink-0 grow-0 basis-14 flex-col data-open:grow"
    >
      <SidebarGroup className="min-h-0 flex-1">
        <SidebarGroupLabel
          render={<CollapsibleTrigger aria-label={label} />}
          className="h-10 w-full cursor-pointer justify-start"
        >
          <span>
            {label}({count})
          </span>
          <ChevronDown className="ml-auto transition-transform duration-200 ease-out group-data-closed/section:-rotate-90 motion-reduce:transition-none" />
        </SidebarGroupLabel>
        <CollapsibleContent
          keepMounted
          className="flex min-h-0 flex-1 flex-col overflow-hidden [[hidden]]:hidden"
        >
          <ScrollArea
            render={<section />}
            aria-label={label}
            className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
          >
            {children}
          </ScrollArea>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
