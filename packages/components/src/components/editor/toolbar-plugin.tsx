import { $createCodeNode } from "@lexical/code";
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { mergeRegister } from "@lexical/utils";
import { FluidHighlight } from "@lunarscribe/components/fluid-motion/fluid-motion";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { Separator } from "@lunarscribe/components/ui/separator";
import { Toggle } from "@lunarscribe/components/ui/toggle";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  type ElementNode,
  FORMAT_TEXT_COMMAND,
  IS_APPLE,
  type LexicalEditor,
  REDO_COMMAND,
  type TextFormatType,
  UNDO_COMMAND,
} from "lexical";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";

const TEXT_FORMATS: {
  format: TextFormatType;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}[] = [
  { format: "bold", label: "Bold", icon: Bold, shortcut: "B" },
  { format: "italic", label: "Italic", icon: Italic, shortcut: "I" },
  { format: "strikethrough", label: "Strikethrough", icon: Strikethrough },
  { format: "code", label: "Inline code", icon: Code },
];

/** Block-level conversions; lists go through commands so ListPlugin can merge siblings. */
const BLOCKS: {
  label: string;
  icon: LucideIcon;
  apply: (editor: LexicalEditor) => void;
}[] = [
  {
    label: "Paragraph",
    icon: Pilcrow,
    apply: (editor) => setBlock(editor, $createParagraphNode),
  },
  {
    label: "Heading 1",
    icon: Heading1,
    apply: (editor) => setBlock(editor, () => $createHeadingNode("h1")),
  },
  {
    label: "Heading 2",
    icon: Heading2,
    apply: (editor) => setBlock(editor, () => $createHeadingNode("h2")),
  },
  {
    label: "Heading 3",
    icon: Heading3,
    apply: (editor) => setBlock(editor, () => $createHeadingNode("h3")),
  },
  {
    label: "Quote",
    icon: Quote,
    apply: (editor) => setBlock(editor, $createQuoteNode),
  },
  {
    label: "Code block",
    icon: SquareCode,
    apply: (editor) => setBlock(editor, $createCodeNode),
  },
  {
    label: "Bulleted list",
    icon: List,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  },
  {
    label: "Numbered list",
    icon: ListOrdered,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  },
  {
    label: "Checkbox list",
    icon: ListChecks,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
  },
  {
    label: "Insert table",
    icon: Table,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: "3",
        columns: "3",
        includeHeaders: { rows: true, columns: false },
      }),
  },
];

/** Converts every block touched by the selection to the node `createBlock` returns. */
function setBlock(editor: LexicalEditor, createBlock: () => ElementNode) {
  editor.update(() => {
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      $setBlocksType(selection, createBlock);
    }
  });
}

function ToolbarSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 h-5 data-vertical:self-center"
    />
  );
}

/** Formatting toolbar: history, inline marks and block types. */
export function ToolbarPlugin() {
  const modifier = IS_APPLE ? "⌘" : "Ctrl";
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<TextFormatType[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            const selection = $getSelection();

            setActiveFormats(
              $isRangeSelection(selection)
                ? TEXT_FORMATS.flatMap(({ format }) =>
                    selection.hasFormat(format) ? [format] : [],
                  )
                : [],
            );
          });
        }),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);

            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);

            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor],
  );

  return (
    <div className="editor-scrollbar min-w-0 shrink-0 overflow-x-auto border-b">
      <div className="relative flex w-max min-w-full items-center justify-center gap-1 px-3 py-1.5">
        <FluidHighlight rows="button" className="bg-muted rounded-lg" />
        <Hint label="Undo" shortcut={[modifier, "Z"]}>
          <Button
            variant="fluid"
            size="icon-sm"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          >
            <Undo2 />
          </Button>
        </Hint>
        <Hint
          label="Redo"
          shortcut={IS_APPLE ? ["⇧", modifier, "Z"] : [modifier, "Y"]}
        >
          <Button
            variant="fluid"
            size="icon-sm"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          >
            <Redo2 />
          </Button>
        </Hint>
        <ToolbarSeparator />
        {TEXT_FORMATS.map(({ format, label, icon: Icon, shortcut }) => (
          <Hint
            key={format}
            label={label}
            shortcut={shortcut ? [modifier, shortcut] : undefined}
          >
            <Toggle
              variant="fluid"
              size="icon-sm"
              aria-label={label}
              pressed={activeFormats.includes(format)}
              onPressedChange={() =>
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
              }
            >
              <Icon />
            </Toggle>
          </Hint>
        ))}
        <ToolbarSeparator />
        {BLOCKS.map(({ label, icon: Icon, apply }) => (
          <Hint key={label} label={label}>
            <Button
              variant="fluid"
              size="icon-sm"
              aria-label={label}
              onClick={() => apply(editor)}
            >
              <Icon />
            </Button>
          </Hint>
        ))}
      </div>
    </div>
  );
}
