import {
  SettingsGroup,
  SettingsRow,
} from "@lunarscribe/components/settings-dialog/settings-pane";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@lunarscribe/components/ui/select";
import { useEffect, useState } from "react";

import { useAppearanceStore } from "@/stores/appearance-store";

const DEFAULT_FONTS = ["Poppins", "Roboto Mono", "Pixelify Sans"] as const;

function FontSelect({
  label,
  font,
  systemFonts,
  onFontChange,
}: {
  label: string;
  font: string;
  systemFonts: string[];
  onFontChange: (font: string) => void;
}) {
  const items = Object.fromEntries(
    [...DEFAULT_FONTS, ...systemFonts, font].map((family) => [family, family]),
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
        {systemFonts.length > 0 && (
          <SelectGroup>
            <SelectLabel>System fonts</SelectLabel>
            {systemFonts.map((family) => (
              <SelectItem key={family} value={family}>
                {family}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

/** Shares one installed-font listing between the UI, buffer, and code selectors. */
export function FontSettings() {
  const uiFont = useAppearanceStore((state) => state.uiFont);
  const bufferFont = useAppearanceStore((state) => state.bufferFont);
  const codeFont = useAppearanceStore((state) => state.codeFont);
  const setUiFont = useAppearanceStore((state) => state.setUiFont);
  const setBufferFont = useAppearanceStore((state) => state.setBufferFont);
  const setCodeFont = useAppearanceStore((state) => state.setCodeFont);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const loadFonts = async () => {
      if (!window.queryLocalFonts) {
        setStatus("error");

        return;
      }

      try {
        const fonts = await window.queryLocalFonts();
        const families = new Set(fonts.map(({ family }) => family));

        for (const family of DEFAULT_FONTS) {
          families.delete(family);
        }

        if (!active) {
          return;
        }

        setSystemFonts([...families].sort((a, b) => a.localeCompare(b)));
        setStatus("ready");
      } catch {
        if (active) {
          setStatus("error");
        }
      }
    };

    void loadFonts();

    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <SettingsGroup
      title="Fonts"
      description={
        <span aria-live="polite">
          {status === "loading" && "Loading system fonts…"}
          {status === "ready" &&
            (systemFonts.length === 0
              ? "No other fonts are installed; the default fonts are listed."
              : "The default fonts and the fonts installed on this computer.")}
          {status === "error" &&
            "Couldn’t load system fonts. The default fonts are still available."}
        </span>
      }
      action={
        status === "error" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("loading");
              setAttempt((previous) => previous + 1);
            }}
          >
            Retry
          </Button>
        )
      }
    >
      <SettingsRow title="UI font" description="Menus, sidebars and dialogs.">
        <FontSelect
          label="UI font"
          font={uiFont}
          systemFonts={systemFonts}
          onFontChange={setUiFont}
        />
      </SettingsRow>
      <SettingsRow title="Buffer font" description="The text you write.">
        <FontSelect
          label="Buffer font"
          font={bufferFont}
          systemFonts={systemFonts}
          onFontChange={setBufferFont}
        />
      </SettingsRow>
      <SettingsRow title="Code font" description="Code blocks and inline code.">
        <FontSelect
          label="Code font"
          font={codeFont}
          systemFonts={systemFonts}
          onFontChange={setCodeFont}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
