import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  type ElementTransformer,
  MULTILINE_ELEMENT_TRANSFORMERS,
  QUOTE,
  type Transformer,
} from "@lexical/markdown";

import { HORIZONTAL_RULE } from "./horizontal-rule-transformer";
import { MARKDOWN_IMAGE, WIKILINK_IMAGE } from "./image-transformers";
import { INLINE_TRANSFORMERS } from "./inline-transformers";
import { BLOCK_MATH, BLOCK_MATH_SHORTCUT } from "./math-transformers";
import { MERMAID, MERMAID_SHORTCUT } from "./mermaid-transformers";
import { TABLE } from "./table-transformer";

/**
 * CommonMark allows a quote's blank line to be a bare `>`, but Lexical's QUOTE
 * only matches `> `. Without this, that line imports as a literal `>` paragraph
 * that splits the quote in two. Export still goes through QUOTE, which writes
 * `> ` for the blank line.
 */
const QUOTE_BLANK_LINE: ElementTransformer = {
  dependencies: QUOTE.dependencies,
  export: () => null,
  regExp: /^>[ \t]*$/,
  replace: (parentNode, children, match, isImport) =>
    isImport ? QUOTE.replace(parentNode, children, match, isImport) : false,
  type: "element",
};

export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  CHECK_LIST,
  HORIZONTAL_RULE,
  BLOCK_MATH_SHORTCUT,
  MERMAID_SHORTCUT,
  WIKILINK_IMAGE,
  MARKDOWN_IMAGE,
  QUOTE_BLANK_LINE,
  ...ELEMENT_TRANSFORMERS,
  BLOCK_MATH,
  MERMAID,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...INLINE_TRANSFORMERS,
  TABLE,
];
