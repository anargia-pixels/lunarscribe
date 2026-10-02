import { Kbd, KbdGroup } from "@lunarscribe/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@lunarscribe/components/ui/tooltip";
import type { ComponentProps, ReactElement } from "react";

/** Renders `children` as the tooltip trigger so the control itself receives hover and focus. */
export function Hint({
  label,
  side,
  shortcut,
  children,
}: {
  label: string;
  side?: ComponentProps<typeof TooltipContent>["side"];
  shortcut?: readonly string[];
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {shortcut && (
            <KbdGroup>
              {shortcut.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
