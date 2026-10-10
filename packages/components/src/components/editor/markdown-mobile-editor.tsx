import { $convertToMarkdownString } from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { Button } from "@lunarscribe/components/ui/button";
import { Separator } from "@lunarscribe/components/ui/separator";
import { Toggle } from "@lunarscribe/components/ui/toggle";
import {
  type EditorState,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import { ChevronDown, Redo2, Undo2 } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";

import { createMarkdownConfig } from "./markdown-config";
import { CheckListReorderPlugin } from "./plugins/check-list-reorder-plugin";
import { CodeHighlightPlugin } from "./plugins/code-highlight-plugin";
import { EditorContextMenuPlugin } from "./plugins/editor-context-menu-plugin";
import { MarkdownShortcutPlugin } from "./plugins/markdown-shortcut-plugin";
import { MARKDOWN_TRANSFORMERS } from "./plugins/markdown-transformers";
import { MathPlugin } from "./plugins/math-plugin";
import { MermaidPlugin } from "./plugins/mermaid-plugin";
import { TableCellMenuPlugin } from "./plugins/table-cell-menu-plugin";
import {
  INSERTIONS,
  InsertMenu,
  TEXT_FORMATS,
  TextFormatMenu,
  useToolbarState,
} from "./toolbar-plugin";

/** Keeps the editor focused, and the keyboard open, when a toolbar button is tapped. */
function keepEditorFocus(event: MouseEvent) {
  event.preventDefault();
}

function ToolbarSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 h-6 data-vertical:self-center"
    />
  );
}

/**
 * Touch toolbar docked under the document, so it sits just above the keyboard. One
 * row of large buttons, without the desktop hover hints and highlight. As the row
 * narrows, the insertions and then the inline marks fold into menus.
 */
function MobileToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const { activeFormats, canUndo, canRedo } = useToolbarState(editor);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const focus = () => setIsFocused(true);
    const blur = () => setIsFocused(false);

    return editor.registerRootListener((root, previousRoot) => {
      previousRoot?.removeEventListener("focus", focus);
      previousRoot?.removeEventListener("blur", blur);
      root?.addEventListener("focus", focus);
      root?.addEventListener("blur", blur);
    });
  }, [editor]);

  return (
    <div className="bg-background flex shrink-0 items-center border-t">
      <div className="editor-scrollbar @container min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
        <div className="flex w-max items-center gap-0.5 px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Undo"
            disabled={!canUndo}
            onMouseDown={keepEditorFocus}
            onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Redo"
            disabled={!canRedo}
            onMouseDown={keepEditorFocus}
            onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          >
            <Redo2 />
          </Button>
          <ToolbarSeparator />
          <div className="hidden @2xl:contents">
            {TEXT_FORMATS.map(({ format, label, icon: Icon }) => (
              <Toggle
                key={format}
                size="lg"
                aria-label={label}
                pressed={activeFormats.includes(format)}
                onMouseDown={keepEditorFocus}
                onPressedChange={() =>
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
                }
              >
                <Icon />
              </Toggle>
            ))}
          </div>
          <TextFormatMenu
            activeFormats={activeFormats}
            button={
              <Button
                variant="ghost"
                size="lg"
                className="@2xl:hidden"
                onMouseDown={keepEditorFocus}
              />
            }
          />
          <ToolbarSeparator />
          <div className="hidden @3xl:contents">
            {INSERTIONS.map(({ label, icon: Icon, apply }) => (
              <Button
                key={label}
                variant="ghost"
                size="icon-lg"
                aria-label={label}
                onMouseDown={keepEditorFocus}
                onClick={() => apply(editor)}
              >
                <Icon />
              </Button>
            ))}
          </div>
          <InsertMenu
            button={
              <Button
                variant="ghost"
                size="lg"
                className="@3xl:hidden"
                onMouseDown={keepEditorFocus}
              />
            }
          />
        </div>
      </div>
      {isFocused && (
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Hide keyboard"
          className="mx-1 shrink-0"
          onClick={() => editor.blur()}
        >
          <ChevronDown />
        </Button>
      )}
    </div>
  );
}

/** Keeps the caret visible when the keyboard opens and the page shrinks. */
function ScrollCaretIntoViewPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const reveal = () => {
      const root = editor.getRootElement();
      const anchor = window.getSelection()?.focusNode;

      const element =
        anchor instanceof Element ? anchor : anchor?.parentElement;

      if (root && element && root.contains(element)) {
        element.scrollIntoView({ block: "nearest" });
      }
    };

    viewport.addEventListener("resize", reveal);

    return () => viewport.removeEventListener("resize", reveal);
  }, [editor]);

  return null;
}

/**
 * Touch-first variant of the WYSIWYG markdown editor for phones and tablets. It uses
 * the platform's own caret, selection handles and scrolling, which the desktop
 * editor replaces, and docks a touch toolbar under the document. Loads `markdown`
 * once on mount (remount via `key` to load a different buffer) and reports markdown
 * on every content change.
 */
export function MarkdownMobileEditor({
  markdown,
  onChange,
}: {
  markdown: string;
  onChange: (markdown: string) => void;
}) {
  const initialConfig = createMarkdownConfig(markdown);

  const handleChange = (editorState: EditorState) =>
    editorState.read(() =>
      onChange(
        $convertToMarkdownString(MARKDOWN_TRANSFORMERS, undefined, true),
      ),
    );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pt-5">
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
                  className="font-buffer w-full min-w-0 flex-1 pb-24 outline-none select-text"
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <TableCellMenuPlugin />
          </EditorContextMenuPlugin>
        </div>
      </div>
      <MobileToolbarPlugin />
      <ScrollCaretIntoViewPlugin />
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
