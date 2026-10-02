import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  type Transformer,
} from "@lexical/markdown";

import { HORIZONTAL_RULE } from "./horizontal-rule-transformer";
import { INLINE_TRANSFORMERS } from "./inline-transformers";
import { TABLE } from "./table-transformer";

export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  CHECK_LIST,
  HORIZONTAL_RULE,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...INLINE_TRANSFORMERS,
  TABLE,
];
