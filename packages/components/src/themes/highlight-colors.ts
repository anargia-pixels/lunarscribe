/** Colors the `==text==` highlighter can paint with; highlighted text is drawn dark on them. */
export const HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Yellow", value: "#facc15" },
  { id: "orange", label: "Orange", value: "#fb923c" },
  { id: "red", label: "Red", value: "#f87171" },
  { id: "pink", label: "Pink", value: "#f472b6" },
  { id: "purple", label: "Purple", value: "#c084fc" },
  { id: "blue", label: "Blue", value: "#60a5fa" },
  { id: "green", label: "Green", value: "#4ade80" },
] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]["id"];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

/** The hex value of a highlight color, falling back to the default for unknown ids. */
export function highlightColorValue(id: string) {
  const color =
    HIGHLIGHT_COLORS.find((candidate) => candidate.id === id) ??
    HIGHLIGHT_COLORS[0];

  return color.value;
}
