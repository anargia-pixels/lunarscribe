import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import type { ReactNode } from "react";

/**
 * The sidebar's scrolling file list: saved files and tracked external files together.
 * `emptyMessage` shows instead of `children` while there is nothing to list.
 */
export function SidebarFileList({
  emptyMessage,
  children,
}: {
  emptyMessage: string | null;
  children: ReactNode;
}) {
  return (
    <ScrollArea
      render={<section />}
      aria-label="Files"
      className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
    >
      {emptyMessage === null ? (
        <div className="px-2">{children}</div>
      ) : (
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          {emptyMessage}
        </p>
      )}
    </ScrollArea>
  );
}
