import {
  BOLD_UNDERSCORE,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type TextFormatTransformer,
  type Transformer,
} from "@lexical/markdown";

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
  ...TEXT_MATCH_TRANSFORMERS,
];
