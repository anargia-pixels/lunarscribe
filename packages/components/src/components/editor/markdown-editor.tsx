import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import {
  type InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import type { EditorState } from "lexical";

import { editorTheme } from "./editor-theme";
import { ToolbarPlugin } from "./toolbar-plugin";

/** Every node type the markdown TRANSFORMERS can produce. */
const MARKDOWN_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
];

/**
 * WYSIWYG markdown editor. Loads `markdown` once on mount (remount via `key` to
 * load a different document) and reports markdown on every content change.
 */
export function MarkdownEditor({
  markdown,
  onChange,
}: {
  markdown: string;
  onChange: (markdown: string) => void;
}) {
  const initialConfig: InitialConfigType = {
    namespace: "lunarscribe",
    theme: editorTheme,
    nodes: MARKDOWN_NODES,
    editorState: () => $convertFromMarkdownString(markdown, TRANSFORMERS),
    onError: (error) => {
      throw error;
    },
  };

  const handleChange = (editorState: EditorState) =>
    editorState.read(() => onChange($convertToMarkdownString(TRANSFORMERS)));

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ToolbarPlugin />
      <ScrollArea className="min-h-0 flex-1">
        <div className="relative flex min-h-full w-full flex-col px-8 py-10">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-label="Document"
                aria-placeholder="Start writing…"
                placeholder={
                  <div className="text-muted-foreground pointer-events-none absolute top-10 left-8 select-none">
                    Start writing…
                  </div>
                }
                className="flex-1 outline-none"
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </ScrollArea>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
    </LexicalComposer>
  );
}
