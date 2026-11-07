import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  type Transformer,
} from "@lexical/markdown";

import { HORIZONTAL_RULE } from "./horizontal-rule-transformer";
import { MARKDOWN_IMAGE, WIKILINK_IMAGE } from "./image-transformers";
import { INLINE_TRANSFORMERS } from "./inline-transformers";
import { BLOCK_MATH, BLOCK_MATH_SHORTCUT } from "./math-transformers";
import { MERMAID, MERMAID_SHORTCUT } from "./mermaid-transformers";
import { TABLE } from "./table-transformer";

export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  CHECK_LIST,
  HORIZONTAL_RULE,
  BLOCK_MATH_SHORTCUT,
  MERMAID_SHORTCUT,
  WIKILINK_IMAGE,
  MARKDOWN_IMAGE,
  ...ELEMENT_TRANSFORMERS,
  BLOCK_MATH,
  MERMAID,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...INLINE_TRANSFORMERS,
  TABLE,
];
