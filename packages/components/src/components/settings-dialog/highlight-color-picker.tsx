import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from "@lunarscribe/components/themes/highlight-colors";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@lunarscribe/components/ui/toggle-group";
import type { CSSProperties } from "react";

type SwatchStyle = CSSProperties & { "--swatch": string };

/** Picks the color `==text==` highlights are painted with. */
export function HighlightColorPicker({
  value,
  onValueChange,
}: {
  value: HighlightColor;
  onValueChange: (value: HighlightColor) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-sm">Highlighter</span>
      <ToggleGroup
        aria-label="Highlighter color"
        spacing={1}
        value={[value]}
        onValueChange={(next) => {
          const selected = HIGHLIGHT_COLORS.find(
            (color) => color.id === next[0],
          );

          // Pressing the selected color again would clear it; keep one selected.
          if (selected) {
            onValueChange(selected.id);
          }
        }}
      >
        {HIGHLIGHT_COLORS.map((color) => {
          const style: SwatchStyle = { "--swatch": color.value };

          return (
            <ToggleGroupItem
              key={color.id}
              value={color.id}
              size="sm"
              aria-label={color.label}
              title={color.label}
            >
              <span
                className="ring-foreground/15 size-4 rounded-full bg-(--swatch) ring-1"
                style={style}
              />
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
