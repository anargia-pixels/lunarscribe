import {
  ArrowDown01Icon,
  CheckListIcon,
  CodeIcon,
  CodeSquareIcon,
  GitForkIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  ParagraphIcon,
  PlusSignIcon,
  QuoteDownIcon,
  Redo02Icon,
  SigmaIcon,
  SquareSigmaIcon,
  Table01Icon,
  TextBoldIcon,
  TextFontIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextSubscriptIcon,
  TextSuperscriptIcon,
  TextUnderlineIcon,
  Undo02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@lunarscribe/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@lunarscribe/components/ui/popover";
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
import { type ReactElement, type ReactNode, useEffect, useState } from "react";

import {
  $applyLink,
  $getLinkDraft,
  $removeLink,
  type LinkDraft,
  LinkForm,
} from "./link-form";
import { INSERT_MATH_COMMAND } from "./plugins/math-plugin";
import { INSERT_MERMAID_COMMAND } from "./plugins/mermaid-plugin";
import { useEditable, useViewOnly } from "./use-editable";

type ToolbarAction = {
  label: string;
  icon: IconSvgElement;
  apply: (editor: LexicalEditor) => void;
};

export const TEXT_FORMATS: {
  format: TextFormatType;
  label: string;
  icon: IconSvgElement;
  shortcut?: string;
}[] = [
  { format: "bold", label: "Bold", icon: TextBoldIcon, shortcut: "B" },
  { format: "italic", label: "Italic", icon: TextItalicIcon, shortcut: "I" },
  {
    format: "underline",
    label: "Underline",
    icon: TextUnderlineIcon,
    shortcut: "U",
  },
  {
    format: "strikethrough",
    label: "Strikethrough",
    icon: TextStrikethroughIcon,
  },
  { format: "superscript", label: "Superscript", icon: TextSuperscriptIcon },
  { format: "subscript", label: "Subscript", icon: TextSubscriptIcon },
  { format: "code", label: "Inline code", icon: CodeIcon },
];

/** Block types; lists go through commands so ListPlugin can merge siblings. */
export const BLOCK_TYPES: ToolbarAction[] = [
  {
    label: "Paragraph",
    icon: ParagraphIcon,
    apply: (editor) => setBlock(editor, $createParagraphNode),
  },
  {
    label: "Heading 1",
    icon: Heading01Icon,
    apply: (editor) => setBlock(editor, () => $createHeadingNode("h1")),
  },
  {
    label: "Heading 2",
    icon: Heading02Icon,
    apply: (editor) => setBlock(editor, () => $createHeadingNode("h2")),
  },
  {
    label: "Heading 3",
    icon: Heading03Icon,
    apply: (editor) => setBlock(editor, () => $createHeadingNode("h3")),
  },
  {
    label: "Quote",
    icon: QuoteDownIcon,
    apply: (editor) => setBlock(editor, $createQuoteNode),
  },
  {
    label: "Bulleted list",
    icon: LeftToRightListBulletIcon,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  },
  {
    label: "Numbered list",
    icon: LeftToRightListNumberIcon,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  },
  {
    label: "Checkbox list",
    icon: CheckListIcon,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
  },
];

/** Inserted blocks: code, tables, math and diagrams. */
export const INSERTS: ToolbarAction[] = [
  {
    label: "Code block",
    icon: CodeSquareIcon,
    apply: (editor) => setBlock(editor, $createCodeNode),
  },
  {
    label: "Insert table",
    icon: Table01Icon,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: "3",
        columns: "3",
        includeHeaders: { rows: true, columns: false },
      }),
  },
  {
    label: "Insert inline math",
    icon: SigmaIcon,
    apply: (editor) => editor.dispatchCommand(INSERT_MATH_COMMAND, true),
  },
  {
    label: "Insert math block",
    icon: SquareSigmaIcon,
    apply: (editor) => editor.dispatchCommand(INSERT_MATH_COMMAND, false),
  },
  {
    label: "Insert Mermaid block",
    icon: GitForkIcon,
    apply: (editor) =>
      editor.dispatchCommand(INSERT_MERMAID_COMMAND, undefined),
  },
];

/** Block types and inserted blocks, as the toolbar shows them. */
export const INSERTIONS: ToolbarAction[] = [...BLOCK_TYPES, ...INSERTS];

/** Converts every block touched by the selection to the node `createBlock` returns. */
function setBlock(editor: LexicalEditor, createBlock: () => ElementNode) {
  editor.update(() => {
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      $setBlocksType(selection, createBlock);
    }
  });
}

/** Toolbar state from the editor: active inline formats and undo/redo availability. */
export function useToolbarState(editor: LexicalEditor) {
  const [activeFormats, setActiveFormats] = useState<TextFormatType[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            const selection = $getSelection();

            const formats = $isRangeSelection(selection)
              ? TEXT_FORMATS.flatMap(({ format }) =>
                  selection.hasFormat(format) ? [format] : [],
                )
              : [];

            // Keep the previous array while the formats match, so typing does
            // not re-render the toolbar and the context menu on every keystroke.
            setActiveFormats((previous) =>
              previous.length === formats.length &&
              previous.every((format, index) => format === formats[index])
                ? previous
                : formats,
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

  return { activeFormats, canUndo, canRedo };
}

type ToolbarMenuProps = {
  /** The toolbar's button for the trigger; it gets the menu's icon, label and a chevron. */
  button: ReactElement;
  /** Shows the label as a hover hint, for pointer toolbars. */
  hasHint?: boolean;
};

/** A toolbar section folded into a menu, for toolbars too narrow to show its buttons. */
function ToolbarMenu({
  label,
  icon: Icon,
  button,
  hasHint,
  children,
}: ToolbarMenuProps & {
  label: string;
  icon: IconSvgElement;
  children: ReactNode;
}) {
  const [editor] = useLexicalComposerContext();

  const trigger = (
    <DropdownMenuTrigger render={button}>
      <HugeiconsIcon icon={Icon} strokeWidth={2} data-icon="inline-start" />
      {label}
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        strokeWidth={2}
        data-icon="inline-end"
      />
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {hasHint ? <Hint label={label}>{trigger}</Hint> : trigger}
      <DropdownMenuContent
        className="w-auto"
        finalFocus={() => editor.getRootElement() ?? false} // keeps selection and keyboard
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The inline formats as a menu of checkboxes, checked while the selection has them. */
export function TextFormatMenu({
  activeFormats,
  ...props
}: ToolbarMenuProps & { activeFormats: TextFormatType[] }) {
  const [editor] = useLexicalComposerContext();

  return (
    <ToolbarMenu label="Format" icon={TextFontIcon} {...props}>
      {TEXT_FORMATS.map(({ format, label, icon: Icon }) => (
        <DropdownMenuCheckboxItem
          key={format}
          checked={activeFormats.includes(format)}
          onCheckedChange={() =>
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
          }
        >
          <HugeiconsIcon icon={Icon} strokeWidth={2} />
          {label}
        </DropdownMenuCheckboxItem>
      ))}
    </ToolbarMenu>
  );
}

/** The block types and insertions as a menu. */
export function InsertMenu(props: ToolbarMenuProps) {
  const [editor] = useLexicalComposerContext();

  return (
    <ToolbarMenu label="Insert" icon={PlusSignIcon} {...props}>
      {INSERTIONS.map(({ label, icon: Icon, apply }) => (
        <DropdownMenuItem key={label} onClick={() => apply(editor)}>
          <HugeiconsIcon icon={Icon} strokeWidth={2} />
          {label}
        </DropdownMenuItem>
      ))}
    </ToolbarMenu>
  );
}

const EMPTY_LINK_DRAFT: LinkDraft = { text: "", url: "", isLink: false };

/** Adds a link to the selection, or edits the link around it. */
function LinkButton({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_LINK_DRAFT);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(editor.read($getLinkDraft));
    }

    setOpen(nextOpen);
  };

  const finish = (apply?: () => void) => {
    setOpen(false);

    if (apply) {
      editor.update(apply);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Hint label="Link">
        <PopoverTrigger
          render={
            <Button
              variant="fluid"
              size="icon-sm"
              aria-label="Link"
              disabled={disabled}
            />
          }
        >
          <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        initialFocus={false}
        finalFocus={() => editor.getRootElement() ?? false}
      >
        {open && (
          <LinkForm
            draft={draft}
            onSubmit={(text, url) => finish(() => $applyLink(text, url))}
            onRemove={() => finish($removeLink)}
            onCancel={() => finish()}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function ToolbarSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 h-5 data-vertical:self-center"
    />
  );
}

/** Its own component, so switching re-renders only the toggle before the paint. */
function ViewOnlyToggle() {
  const [editor] = useLexicalComposerContext();
  const [isViewOnly, setViewOnly] = useViewOnly(editor);

  return (
    <Toggle
      variant="fluid"
      size="icon-sm"
      aria-label="View only"
      pressed={isViewOnly}
      onPressedChange={setViewOnly}
    >
      <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
    </Toggle>
  );
}

/**
 * Formatting toolbar: view only and history, then inline marks, and block types with
 * insertions. View only and history stay outside the scrolling row, so they are always
 * visible. As the toolbar narrows, the insertions and then the inline marks fold into
 * menus.
 */
export function ToolbarPlugin() {
  const modifier = IS_APPLE ? "⌘" : "Ctrl";
  const [editor] = useLexicalComposerContext();
  const { activeFormats, canUndo, canRedo } = useToolbarState(editor);
  const isEditable = useEditable(editor);

  return (
    <div className="@container min-w-0 shrink-0 border-b">
      <div className="flex justify-center">
        <div className="relative flex shrink-0 items-center gap-1 py-1.5 pl-3">
          <FluidHighlight rows="button" className="bg-muted rounded-lg" />
          <Hint label="View only">
            <ViewOnlyToggle />
          </Hint>
          <Hint label="Undo" shortcut={[modifier, "Z"]}>
            <Button
              variant="fluid"
              size="icon-sm"
              aria-label="Undo"
              disabled={!isEditable || !canUndo}
              onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
            >
              <HugeiconsIcon icon={Undo02Icon} strokeWidth={2} />
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
              disabled={!isEditable || !canRedo}
              onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
            >
              <HugeiconsIcon icon={Redo02Icon} strokeWidth={2} />
            </Button>
          </Hint>
          <ToolbarSeparator />
        </div>
        <div className="editor-scrollbar min-w-0 overflow-x-auto">
          <div className="relative flex w-max items-center gap-1 py-1.5 pr-3 pl-1">
            <FluidHighlight rows="button" className="bg-muted rounded-lg" />
            <div className="hidden @2xl:contents">
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
                    disabled={!isEditable}
                    pressed={activeFormats.includes(format)}
                    onPressedChange={() =>
                      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
                    }
                  >
                    <HugeiconsIcon icon={Icon} strokeWidth={2} />
                  </Toggle>
                </Hint>
              ))}
            </div>
            <TextFormatMenu
              activeFormats={activeFormats}
              hasHint
              button={
                <Button
                  variant="fluid"
                  size="sm"
                  className="@2xl:hidden"
                  disabled={!isEditable}
                />
              }
            />
            <LinkButton disabled={!isEditable} />
            <ToolbarSeparator />
            <div className="hidden @3xl:contents">
              {INSERTIONS.map(({ label, icon: Icon, apply }) => (
                <Hint key={label} label={label}>
                  <Button
                    variant="fluid"
                    size="icon-sm"
                    aria-label={label}
                    disabled={!isEditable}
                    onClick={() => apply(editor)}
                  >
                    <HugeiconsIcon icon={Icon} strokeWidth={2} />
                  </Button>
                </Hint>
              ))}
            </div>
            <InsertMenu
              hasHint
              button={
                <Button
                  variant="fluid"
                  size="sm"
                  className="@3xl:hidden"
                  disabled={!isEditable}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
