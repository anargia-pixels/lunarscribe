import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@lunarscribe/components/ui/select";

import { DEFAULT_FONTS, GOOGLE_FONT_GROUPS } from "@/lib/google-fonts";
import { useAppearanceStore } from "@/stores/appearance-store";

function FontSelect({
  label,
  font,
  onFontChange,
}: {
  label: string;
  font: string;
  onFontChange: (font: string) => void;
}) {
  const items = Object.fromEntries(
    [
      ...DEFAULT_FONTS,
      ...GOOGLE_FONT_GROUPS.flatMap((group) => group.families),
      font,
    ].map((family) => [family, family]),
  );

  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-sm">{label}</span>
      <Select<string>
        items={items}
        value={font}
        onValueChange={(next) => {
          if (next !== null) {
            onFontChange(next);
          }
        }}
      >
        <SelectTrigger className="w-64 justify-between" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>Default</SelectLabel>
            {DEFAULT_FONTS.map((family) => (
              <SelectItem key={family} value={family}>
                {family}
              </SelectItem>
            ))}
          </SelectGroup>
          {GOOGLE_FONT_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.families.map((family) => (
                <SelectItem key={family} value={family}>
                  {family}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** UI, buffer, and code font selectors over the default and Google Fonts families. */
export function FontSettings() {
  const uiFont = useAppearanceStore((state) => state.uiFont);
  const bufferFont = useAppearanceStore((state) => state.bufferFont);
  const codeFont = useAppearanceStore((state) => state.codeFont);
  const setUiFont = useAppearanceStore((state) => state.setUiFont);
  const setBufferFont = useAppearanceStore((state) => state.setBufferFont);
  const setCodeFont = useAppearanceStore((state) => state.setCodeFont);

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-medium">Fonts</h3>
        <p className="text-muted-foreground text-sm text-pretty">
          Choose fonts for the interface, buffer writing, and code. Default
          fonts work offline; the others load from Google Fonts.
        </p>
      </header>
      <FontSelect label="UI font" font={uiFont} onFontChange={setUiFont} />
      <FontSelect
        label="Buffer font"
        font={bufferFont}
        onFontChange={setBufferFont}
      />
      <FontSelect
        label="Code font"
        font={codeFont}
        onFontChange={setCodeFont}
      />
    </div>
  );
}
