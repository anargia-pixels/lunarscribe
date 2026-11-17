import { Add01Icon, RotateLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  COLOR_THEME_LABELS,
  ColorThemeSelect,
} from "@lunarscribe/components/settings-dialog/color-theme-select";
import { EditorSpacingSelect } from "@lunarscribe/components/settings-dialog/editor-spacing-select";
import { HighlightColorPicker } from "@lunarscribe/components/settings-dialog/highlight-color-picker";
import { ImportColorThemeDialog } from "@lunarscribe/components/settings-dialog/import-color-theme-dialog";
import { ImportedColorThemeList } from "@lunarscribe/components/settings-dialog/imported-color-theme-list";
import {
  SettingsBlock,
  SettingsGroup,
  SettingsPane,
  SettingsRow,
} from "@lunarscribe/components/settings-dialog/settings-pane";
import type { ImportedColorTheme } from "@lunarscribe/components/themes/imported-color-themes";
import { Button } from "@lunarscribe/components/ui/button";
import { Switch } from "@lunarscribe/components/ui/switch";
import { useState } from "react";

import { useAppearanceStore } from "@/stores/appearance-store";

import { FontSettings } from "./font-settings";

/** Light and dark color themes, importing more, and the imported ones. */
function ColorThemeSettings() {
  const lightColorTheme = useAppearanceStore((state) => state.lightColorTheme);
  const darkColorTheme = useAppearanceStore((state) => state.darkColorTheme);

  const importedColorThemes = useAppearanceStore(
    (state) => state.importedColorThemes,
  );

  const setLightColorTheme = useAppearanceStore(
    (state) => state.setLightColorTheme,
  );

  const setDarkColorTheme = useAppearanceStore(
    (state) => state.setDarkColorTheme,
  );

  const addImportedColorThemes = useAppearanceStore(
    (state) => state.addImportedColorThemes,
  );

  const removeImportedColorTheme = useAppearanceStore(
    (state) => state.removeImportedColorTheme,
  );

  const resetColorThemes = useAppearanceStore(
    (state) => state.resetColorThemes,
  );

  const [isImportOpen, setIsImportOpen] = useState(false);

  // A single imported color theme is applied right away to every theme it has colors for.
  const handleImport = (themes: ImportedColorTheme[]) => {
    addImportedColorThemes(themes);

    const [imported] = themes;

    if (themes.length !== 1 || imported === undefined) {
      return;
    }

    if (imported.light) {
      setLightColorTheme(imported.id);
    }

    if (imported.dark) {
      setDarkColorTheme(imported.id);
    }
  };

  return (
    <SettingsGroup
      title="Color theme"
      description="A color theme restyles every color in the app. Light and dark each pick their own."
      action={
        <Button
          variant="ghost"
          size="sm"
          disabled={lightColorTheme === null && darkColorTheme === null}
          onClick={resetColorThemes}
        >
          <HugeiconsIcon icon={RotateLeft01Icon} strokeWidth={2} />
          Reset
        </Button>
      }
    >
      <SettingsRow title={COLOR_THEME_LABELS.light}>
        <ColorThemeSelect
          theme="light"
          colorTheme={lightColorTheme}
          importedColorThemes={importedColorThemes}
          onColorThemeChange={setLightColorTheme}
        />
      </SettingsRow>
      <SettingsRow title={COLOR_THEME_LABELS.dark}>
        <ColorThemeSelect
          theme="dark"
          colorTheme={darkColorTheme}
          importedColorThemes={importedColorThemes}
          onColorThemeChange={setDarkColorTheme}
        />
      </SettingsRow>
      <SettingsRow
        title="Imported color themes"
        description="Add T3 skins and VS Code themes from their galleries or from a file."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsImportOpen(true)}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Import
        </Button>
      </SettingsRow>
      {importedColorThemes.length > 0 && (
        <SettingsBlock>
          <ImportedColorThemeList
            themes={importedColorThemes}
            onRemove={removeImportedColorTheme}
          />
        </SettingsBlock>
      )}
      <ImportColorThemeDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        importedIds={new Set(importedColorThemes.map(({ id }) => id))}
        onImport={handleImport}
      />
    </SettingsGroup>
  );
}

/** Line spacing, spell check, the highlighter color, and the toolbar. */
function EditorSettings() {
  const bufferSpacing = useAppearanceStore((state) => state.bufferSpacing);

  const setBufferSpacing = useAppearanceStore(
    (state) => state.setBufferSpacing,
  );

  const spellCheck = useAppearanceStore((state) => state.spellCheck);
  const setSpellCheck = useAppearanceStore((state) => state.setSpellCheck);
  const highlightColor = useAppearanceStore((state) => state.highlightColor);

  const setHighlightColor = useAppearanceStore(
    (state) => state.setHighlightColor,
  );

  const showEditorToolbar = useAppearanceStore(
    (state) => state.showEditorToolbar,
  );

  const setShowEditorToolbar = useAppearanceStore(
    (state) => state.setShowEditorToolbar,
  );

  return (
    <SettingsGroup title="Editor">
      <SettingsRow
        title="Spacing"
        description="How much room the text you write gets between lines."
        htmlFor="editor-spacing"
      >
        <EditorSpacingSelect
          id="editor-spacing"
          spacing={bufferSpacing}
          onSpacingChange={setBufferSpacing}
        />
      </SettingsRow>
      <SettingsRow
        title="Spell check"
        description="Underline misspelled words with a squiggly line."
        htmlFor="spell-check"
      >
        <Switch
          id="spell-check"
          checked={spellCheck}
          onCheckedChange={setSpellCheck}
        />
      </SettingsRow>
      <SettingsRow
        title="Highlighter"
        description="The color ==text== highlights are painted with."
      >
        <HighlightColorPicker
          value={highlightColor}
          onValueChange={setHighlightColor}
        />
      </SettingsRow>
      <SettingsRow
        title="Show toolbar"
        description="Formatting buttons above the editor. The right-click menu keeps every action."
        htmlFor="show-editor-toolbar"
      >
        <Switch
          id="show-editor-toolbar"
          checked={showEditorToolbar}
          onCheckedChange={setShowEditorToolbar}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

/** Appearance section: color themes, fonts and editor options. */
export function AppearancePane() {
  return (
    <SettingsPane>
      <ColorThemeSettings />
      <FontSettings />
      <EditorSettings />
    </SettingsPane>
  );
}
