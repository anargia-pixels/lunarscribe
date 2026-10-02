import { PrismTokenizer, registerCodeHighlighting } from "@lexical/code-prism";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

const tokenizer = { ...PrismTokenizer, defaultLanguage: null };

export function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => registerCodeHighlighting(editor, tokenizer), [editor]);

  return null;
}
