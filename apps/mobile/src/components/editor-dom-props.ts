import type { ImageSource } from "@lunarscribe/components/editor/markdown-editor";
import type { ColorPalette } from "@lunarscribe/components/themes/color-themes";
import type { DOMProps } from "expo/dom";

import type { Theme } from "@/lib/editor-types";

/**
 * Props of the editor DOM components. Each loads `content` when `contentKey`
 * changes and reports every edit through `onChange`; the buffer store stays the
 * source of truth. `palette` is the color theme's colors, or null for globals.css.
 * Only the markdown editor has an outline sheet and image embeds: `resolveImage` reads
 * an embed's file next to the buffer, and a new `imageRevision` reads them all again.
 */
export type EditorDomProps = {
  content: string;
  contentKey: string;
  theme: Theme;
  palette: ColorPalette | null;
  isShown: boolean; // false while the editor host hides the page
  onChange: (content: string) => Promise<void>;
  isOutlineOpen: boolean;
  onOutlineOpenChange: (open: boolean) => Promise<void>;
  resolveImage?: (target: string) => Promise<ImageSource>;
  imageRevision?: number;
  dom?: DOMProps;
};
