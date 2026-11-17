import {
  EDITOR_SPACINGS,
  type EditorSpacing,
} from "@lunarscribe/components/themes/editor-spacing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lunarscribe/components/ui/select";

/** Picks how much room the editor's text gets between lines. */
export function EditorSpacingSelect({
  id,
  spacing,
  onSpacingChange,
}: {
  id?: string;
  spacing: EditorSpacing;
  onSpacingChange: (spacing: EditorSpacing) => void;
}) {
  return (
    <Select<EditorSpacing>
      items={EDITOR_SPACINGS}
      value={spacing}
      onValueChange={(next) => {
        if (next !== null) {
          onSpacingChange(next);
        }
      }}
    >
      <SelectTrigger id={id} className="w-56 justify-between">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {EDITOR_SPACINGS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
