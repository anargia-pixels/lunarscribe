import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  ImportedColorTheme,
  ImportedColorThemeSource,
} from "@lunarscribe/components/themes/imported-color-themes";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@lunarscribe/components/ui/item";

import { ColorThemeSwatches } from "./color-theme-select";

const SOURCE_LABELS: Record<ImportedColorThemeSource, string> = {
  "t3-skins": "T3 Skins",
  vscode: "VS Code",
};

/** Where an imported color theme came from and which themes it covers. */
function details(theme: ImportedColorTheme): string {
  const modes = [theme.light && "light", theme.dark && "dark"]
    .filter(Boolean)
    .join(" and ");

  const parts = [SOURCE_LABELS[theme.source], `${modes} theme`];

  if (theme.css !== undefined) {
    parts.push("custom styles");
  }

  return parts.join(" · ");
}

/** The imported color themes, each with its colors and a Remove button. */
export function ImportedColorThemeList({
  themes,
  onRemove,
}: {
  themes: ReadonlyArray<ImportedColorTheme>;
  onRemove: (id: string) => void;
}) {
  if (themes.length === 0) {
    return null;
  }

  return (
    <ItemGroup>
      {themes.map((theme) => {
        const palette = theme.dark ?? theme.light;

        return (
          <Item key={theme.id} variant="outline" size="sm">
            <ItemContent>
              <ItemTitle>{theme.label}</ItemTitle>
              <ItemDescription>{details(theme)}</ItemDescription>
            </ItemContent>
            <div className="flex gap-1">
              {palette && <ColorThemeSwatches palette={palette} />}
            </div>
            <ItemActions>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${theme.label}`}
                title="Remove"
                onClick={() => onRemove(theme.id)}
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
