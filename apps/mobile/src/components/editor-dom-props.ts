import type { DOMProps } from "expo/dom";

import type { Theme } from "@/lib/editor-types";

/**
 * Props of the editor DOM components. Each loads `content` when `contentKey`
 * changes and reports every edit through `onChange`; the buffer store stays the
 * source of truth.
 */
export type EditorDomProps = {
  content: string;
  contentKey: string;
  theme: Theme;
  onChange: (content: string) => Promise<void>;
  dom?: DOMProps;
};
