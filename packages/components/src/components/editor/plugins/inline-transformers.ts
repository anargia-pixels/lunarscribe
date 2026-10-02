import {
  BOLD_UNDERSCORE,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type TextFormatTransformer,
  type Transformer,
} from "@lexical/markdown";

const UNDERLINE: TextFormatTransformer = {
  ...BOLD_UNDERSCORE,
  format: ["underline"],
};

export const INLINE_TRANSFORMERS: Transformer[] = [
  ...TEXT_FORMAT_TRANSFORMERS.map((transformer) =>
    transformer === BOLD_UNDERSCORE ? UNDERLINE : transformer,
  ),
  ...TEXT_MATCH_TRANSFORMERS,
];
