import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "@lunarscribe/utils/cn";

type CollapsibleVariant = "default" | "section";

function Collapsible({
  className,
  variant = "default",
  ...props
}: CollapsiblePrimitive.Root.Props & { variant?: CollapsibleVariant }) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      className={(state) =>
        cn(
          variant === "section" &&
            "transition-[flex-grow] duration-200 ease-out motion-reduce:transition-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  );
}

function CollapsibleTrigger({
  className,
  variant = "default",
  ...props
}: CollapsiblePrimitive.Trigger.Props & {
  variant?: CollapsibleVariant;
}) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={(state) =>
        cn(
          variant === "section" && "uppercase",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  );
}

function CollapsibleContent({
  className,
  variant = "default",
  ...props
}: CollapsiblePrimitive.Panel.Props & { variant?: CollapsibleVariant }) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={(state) =>
        cn(
          variant === "section" &&
            "transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none [[hidden]]:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
