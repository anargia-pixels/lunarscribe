import {
  SettingsGroup,
  SettingsRow,
} from "@lunarscribe/components/settings-dialog/settings-pane";
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
    <Select<string>
      items={items}
      value={font}
      onValueChange={(next) => {
        if (next !== null) {
          onFontChange(next);
        }
      }}
    >
      <SelectTrigger className="w-56 justify-between" aria-label={label}>
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
    <SettingsGroup
      title="Fonts"
      description="Default fonts work offline; the others load from Google Fonts."
    >
      <SettingsRow title="UI font" description="Menus, sidebars and dialogs.">
        <FontSelect label="UI font" font={uiFont} onFontChange={setUiFont} />
      </SettingsRow>
      <SettingsRow title="Buffer font" description="The text you write.">
        <FontSelect
          label="Buffer font"
          font={bufferFont}
          onFontChange={setBufferFont}
        />
      </SettingsRow>
      <SettingsRow title="Code font" description="Code blocks and inline code.">
        <FontSelect
          label="Code font"
          font={codeFont}
          onFontChange={setCodeFont}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
