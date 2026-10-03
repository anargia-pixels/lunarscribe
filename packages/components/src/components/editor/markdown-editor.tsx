import { $convertToMarkdownString } from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import type { EditorState } from "lexical";

import { createMarkdownConfig } from "./markdown-config";
import { CodeHighlightPlugin } from "./plugins/code-highlight-plugin";
import { FindPlugin } from "./plugins/find-plugin";
import { MARKDOWN_TRANSFORMERS } from "./plugins/markdown-transformers";
import { MathPlugin } from "./plugins/math-plugin";
import { TableCellMenuPlugin } from "./plugins/table-cell-menu-plugin";
import { ToolbarPlugin } from "./toolbar-plugin";

/**
 * WYSIWYG markdown editor. Loads `markdown` once on mount (remount via `key` to
 * load a different buffer) and reports markdown on every content change.
 */
export function MarkdownEditor({
  markdown,
  onChange,
}: {
  markdown: string;
  onChange: (markdown: string) => void;
}) {
  const initialConfig = createMarkdownConfig(markdown);

  const handleChange = (editorState: EditorState) =>
    editorState.read(() =>
      onChange($convertToMarkdownString(MARKDOWN_TRANSFORMERS)),
    );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ToolbarPlugin />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <FindPlugin />
        <ScrollArea className="min-h-0 flex-1">
          <div className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col px-8 py-10">
            <TableCellMenuPlugin>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    data-markdown-editor
                    aria-label="Document"
                    aria-placeholder="Start writing…"
                    placeholder={
                      <div className="font-buffer text-muted-foreground pointer-events-none absolute top-0 left-0 select-none">
                        Start writing…
                      </div>
                    }
                    className="font-buffer w-full min-w-0 flex-1 outline-none select-text"
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </TableCellMenuPlugin>
          </div>
        </ScrollArea>
      </div>
      <HistoryPlugin />
      <HorizontalRulePlugin />
      <ListPlugin />
      <CheckListPlugin disableTakeFocusOnClick />
      <TablePlugin
        hasCellMerge={false}
        hasCellBackgroundColor={false}
        hasHorizontalScroll
      />
      <CodeHighlightPlugin />
      <MathPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
      <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
    </LexicalComposer>
  );
}
