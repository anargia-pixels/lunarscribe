import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { useEffect } from "react";

import { createMarkdownConfig } from "./markdown-config";
import { CodeHighlightPlugin } from "./plugins/code-highlight-plugin";

import "./plugins/math-plugin.css";

function PreviewReadyPlugin({
  onReady,
}: {
  onReady: (root: HTMLElement) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Allow syntax highlighting and React math decorators to finish mounting.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const root = editor.getRootElement();

        if (root) {
          onReady(root);
        }
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [editor, onReady]);

  return null;
}

/** A state-agnostic, read-only rendering for exporting markdown without editor controls. */
export function MarkdownPreview({
  markdown,
  onReady,
  onError,
}: {
  markdown: string;
  onReady: (root: HTMLElement) => void;
  onError: (error: Error) => void;
}) {
  const initialConfig = {
    ...createMarkdownConfig(markdown),
    editable: false,
    onError,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable className="font-buffer w-full min-w-0 outline-none" />
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <TablePlugin
        hasCellMerge={false}
        hasCellBackgroundColor={false}
        hasHorizontalScroll
      />
      <CodeHighlightPlugin />
      <PreviewReadyPlugin onReady={onReady} />
    </LexicalComposer>
  );
}
