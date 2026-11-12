import { PrismTokenizer, registerCodeHighlighting } from "@lexical/code-prism";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { defineExtension } from "lexical";
import { useEffect } from "react";

const tokenizer = { ...PrismTokenizer, defaultLanguage: null };

/** Highlighting without the Tab indentation that `CodePrismExtension` adds. */
export const CodeHighlightExtension = defineExtension({
  name: "lunarscribe/code-highlight",
  register: (editor) => registerCodeHighlighting(editor, tokenizer),
});

export function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => registerCodeHighlighting(editor, tokenizer), [editor]);

  return null;
}
