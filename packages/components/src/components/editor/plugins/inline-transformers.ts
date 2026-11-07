import {
  BOLD_UNDERSCORE,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type TextFormatTransformer,
  type Transformer,
} from "@lexical/markdown";

import {
  MARKDOWN_IMAGE_SHORTCUT,
  WIKILINK_IMAGE_SHORTCUT,
} from "./image-transformers";
import {
  BLOCK_MATH_END,
  INLINE_MATH,
  MATH_SOURCE_SHORTCUTS,
} from "./math-transformers";

const UNDERLINE: TextFormatTransformer = {
  ...BOLD_UNDERSCORE,
  format: ["underline"],
};

const SUPERSCRIPT: TextFormatTransformer = {
  format: ["superscript"],
  tag: "^",
  intraword: true,
  type: "text-format",
};

const SUBSCRIPT: TextFormatTransformer = {
  format: ["subscript"],
  tag: "~",
  intraword: true,
  type: "text-format",
};

export const INLINE_TRANSFORMERS: Transformer[] = [
  BLOCK_MATH_END,
  INLINE_MATH,
  ...MATH_SOURCE_SHORTCUTS,
  ...TEXT_FORMAT_TRANSFORMERS.map((transformer) =>
    transformer === BOLD_UNDERSCORE ? UNDERLINE : transformer,
  ),
  SUPERSCRIPT,
  // Keep `~~` ahead of `~` so strikethrough wins over subscript.
  SUBSCRIPT,
  // Ahead of the link shortcut, so `![alt](target)` never becomes `!` and a link.
  WIKILINK_IMAGE_SHORTCUT,
  MARKDOWN_IMAGE_SHORTCUT,
  ...TEXT_MATCH_TRANSFORMERS,
];
