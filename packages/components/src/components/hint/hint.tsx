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
  children,
}: {
  label: string;
  side?: ComponentProps<typeof TooltipContent>["side"];
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
