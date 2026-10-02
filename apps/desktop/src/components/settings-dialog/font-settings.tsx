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

const DEFAULT_FONTS = ["Poppins", "Roboto Mono"] as const;

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
    </div>
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
      try {
        if (!window.queryLocalFonts) {
          throw new Error("Local Font Access is unavailable");
        }

        const fonts = await window.queryLocalFonts();
        const families = new Set(fonts.map(({ family }) => family));

        for (const family of DEFAULT_FONTS) {
          families.delete(family);
        }

        if (active) {
          setSystemFonts([...families].sort((a, b) => a.localeCompare(b)));
          setStatus("ready");
        }
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
    <div className="flex max-w-lg flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-medium">Fonts</h3>
        <p className="text-muted-foreground text-sm text-pretty">
          Choose fonts for the interface, buffer writing, and code.
        </p>
      </header>
      <FontSelect
        label="UI font"
        font={uiFont}
        systemFonts={systemFonts}
        onFontChange={setUiFont}
      />
      <FontSelect
        label="Buffer font"
        font={bufferFont}
        systemFonts={systemFonts}
        onFontChange={setBufferFont}
      />
      <FontSelect
        label="Code font"
        font={codeFont}
        systemFonts={systemFonts}
        onFontChange={setCodeFont}
      />
      {status === "loading" && (
        <p aria-live="polite" className="text-muted-foreground text-sm">
          Loading system fonts…
        </p>
      )}
      {status === "ready" && systemFonts.length === 0 && (
        <p aria-live="polite" className="text-muted-foreground text-sm">
          No additional system fonts found.
        </p>
      )}
      {status === "error" && (
        <div className="flex items-center justify-between gap-6">
          <p aria-live="polite" className="text-muted-foreground text-sm">
            Couldn’t load system fonts. Default fonts are still available.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setStatus("loading");
              setAttempt((previous) => previous + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
