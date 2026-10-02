import { CHECK_LIST, TRANSFORMERS, type Transformer } from "@lexical/markdown";

import { HORIZONTAL_RULE } from "./horizontal-rule-transformer";
import { TABLE } from "./table-transformer";

export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  CHECK_LIST,
  HORIZONTAL_RULE,
  ...TRANSFORMERS,
  TABLE,
];
