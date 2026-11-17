/**
 * How much room the editor's text gets between lines. Comfortable is the
 * editor's original look; globals.css holds its line height too, for the
 * mobile editor and exports, which have no setting.
 */

export type EditorSpacing = "compact" | "standard" | "comfortable";

/** Each spacing with its unitless line height, a multiple of the font size. */
export const EDITOR_SPACINGS = [
  { value: "compact", label: "Compact", lineHeight: 1.4 },
  { value: "standard", label: "Standard", lineHeight: 1.6 },
  { value: "comfortable", label: "Comfortable", lineHeight: 1.75 },
] as const satisfies ReadonlyArray<{
  value: EditorSpacing;
  label: string;
  lineHeight: number;
}>;

export const DEFAULT_EDITOR_SPACING: EditorSpacing = "comfortable";

/** The line height of `spacing`; Comfortable's for a value saved by an older version. */
export function editorSpacingLineHeight(spacing: EditorSpacing): number {
  const match = EDITOR_SPACINGS.find(({ value }) => value === spacing);

  return match?.lineHeight ?? 1.75;
}
