import { $convertToMarkdownString } from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import type { EditorState } from "lexical";
import { useRef, useState } from "react";

import {
  type FrontmatterEntry,
  parseFrontmatter,
  stringifyFrontmatter,
} from "./frontmatter";
import { FrontmatterPanel } from "./frontmatter-panel";
import { createMarkdownConfig } from "./markdown-config";
import { CaretPlugin } from "./plugins/caret-plugin";
import { CheckListReorderPlugin } from "./plugins/check-list-reorder-plugin";
import { CodeHighlightPlugin } from "./plugins/code-highlight-plugin";
import { EditorContextMenuPlugin } from "./plugins/editor-context-menu-plugin";
import { FindPlugin } from "./plugins/find-plugin";
import { HeadingCollapsePlugin } from "./plugins/heading-collapse-plugin";
import { LinkEditorPlugin } from "./plugins/link-editor-plugin";
import { LinkOpenPlugin } from "./plugins/link-open-plugin";
import { MarkdownShortcutPlugin } from "./plugins/markdown-shortcut-plugin";
import { MARKDOWN_TRANSFORMERS } from "./plugins/markdown-transformers";
import { MathPlugin } from "./plugins/math-plugin";
import { MermaidPlugin } from "./plugins/mermaid-plugin";
import { TableCellMenuPlugin } from "./plugins/table-cell-menu-plugin";
import { ToolbarPlugin } from "./toolbar-plugin";

/**
 * WYSIWYG markdown editor. Loads `markdown` once on mount (remount via `key` to
 * load a different buffer) and reports markdown on every content change.
 * Frontmatter is parsed out of the markdown into the frontmatter panel and
 * joined back onto the body of every reported markdown string. The right-click
 * menu holds every toolbar action, so `showToolbar` can hide the toolbar.
 */
export function MarkdownEditor({
  markdown,
  onChange,
  showToolbar = true,
}: {
  markdown: string;
  onChange: (markdown: string) => void;
  showToolbar?: boolean;
}) {
  const initialConfig = createMarkdownConfig(markdown);
  const [parsed] = useState(() => parseFrontmatter(markdown));
  const [entries, setEntries] = useState(parsed.entries);
  // The panel edits frontmatter while Lexical owns the body, so the body keeps
  // its latest text here to compose the markdown both edits report.
  const bodyRef = useRef(parsed.body);

  const handleFrontmatterChange = (nextEntries: FrontmatterEntry[]) => {
    setEntries(nextEntries);
    onChange(stringifyFrontmatter(nextEntries) + bodyRef.current);
  };

  const handleChange = (editorState: EditorState) =>
    editorState.read(() => {
      const body = $convertToMarkdownString(
        MARKDOWN_TRANSFORMERS,
        undefined,
        true,
      );

      bodyRef.current = body;
      onChange(stringifyFrontmatter(entries) + body);
    });

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {showToolbar && <ToolbarPlugin />}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <FindPlugin />
        <ScrollArea className="min-h-0 flex-1">
          <div className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col px-8 pt-10">
            <FrontmatterPanel
              entries={entries}
              onChange={handleFrontmatterChange}
            />
            <EditorContextMenuPlugin>
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
                    className="font-buffer w-full min-w-0 cursor-text pb-48 outline-none select-text"
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <CaretPlugin />
              <HeadingCollapsePlugin />
              <LinkEditorPlugin />
              <LinkOpenPlugin />
              <TableCellMenuPlugin />
            </EditorContextMenuPlugin>
          </div>
        </ScrollArea>
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <CheckListPlugin disableTakeFocusOnClick />
      <CheckListReorderPlugin />
      <TablePlugin
        hasCellMerge={false}
        hasCellBackgroundColor={false}
        hasHorizontalScroll
      />
      <CodeHighlightPlugin />
      <MathPlugin />
      <MermaidPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin />
      <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
    </LexicalComposer>
  );
}
