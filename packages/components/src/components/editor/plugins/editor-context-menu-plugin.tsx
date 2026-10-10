import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@lunarscribe/components/ui/context-menu";
import { tryCatch } from "@lunarscribe/utils/try-catch";
import {
  $getSelection,
  $isRangeSelection,
  $selectAll,
  COPY_COMMAND,
  CUT_COMMAND,
  FORMAT_TEXT_COMMAND,
  IS_APPLE,
  type LexicalEditor,
  type NodeKey,
  PASTE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import {
  ClipboardPaste,
  Copy,
  Link,
  Pilcrow,
  Plus,
  Redo2,
  Scissors,
  Table,
  TextCursorInput,
  TextSelect,
  Type,
  Undo2,
  Unlink,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { $getSelectedLink, $removeLink } from "../link-form";
import {
  BLOCK_TYPES,
  INSERTS,
  TEXT_FORMATS,
  useToolbarState,
} from "../toolbar-plugin";
import { OPEN_LINK_FORM_COMMAND } from "./link-editor-plugin";
import {
  applyAction,
  getCellKey,
  TableMenuItems,
} from "./table-cell-menu-plugin";

type SelectionState = { isLink: boolean; isCollapsed: boolean };

const MODIFIER = IS_APPLE ? "⌘" : "Ctrl+";

/** Pastes the clipboard through Lexical, as the paste shortcut would. */
async function paste(editor: LexicalEditor, plainText: boolean) {
  const clipboardData = new DataTransfer();

  if (plainText) {
    const { data } = await tryCatch(navigator.clipboard.readText());

    clipboardData.setData("text/plain", data ?? "");
  } else {
    const { data: items } = await tryCatch(navigator.clipboard.read());

    for (const item of items ?? []) {
      for (const type of item.types.filter((t) => t.startsWith("text/"))) {
        clipboardData.setData(type, await (await item.getType(type)).text());
      }
    }
  }

  editor.dispatchCommand(
    PASTE_COMMAND,
    new ClipboardEvent("paste", { clipboardData }),
  );
}

/**
 * The editor's right-click menu, modeled on Obsidian's: links, then format,
 * paragraph, insert and table submenus, then history and clipboard actions.
 */
export function EditorContextMenuPlugin({ children }: { children: ReactNode }) {
  const [editor] = useLexicalComposerContext();
  const { activeFormats, canUndo, canRedo } = useToolbarState(editor);
  const [cellKey, setCellKey] = useState<NodeKey | null>(null);

  const [selection, setSelection] = useState<SelectionState>({
    isLink: false,
    isCollapsed: true,
  });

  // Clipboard and link actions need the editor focused, so they run once the
  // menu has closed. The link form keeps focus instead of the editor.
  const afterCloseRef = useRef<(() => void) | null>(null);
  const keepFocusRef = useRef(false);

  useEffect(() => {
    const readSelection = () => {
      const current = $getSelection();
      const isLink = $getSelectedLink() !== null;
      const isCollapsed = !$isRangeSelection(current) || current.isCollapsed();

      setSelection((previous) =>
        previous.isLink === isLink && previous.isCollapsed === isCollapsed
          ? previous
          : { isLink, isCollapsed },
      );
    };

    editor.read(readSelection);

    return editor.registerUpdateListener(({ editorState }) =>
      editorState.read(readSelection),
    );
  }, [editor]);

  const afterClose = (action: () => void, keepFocus = false) => {
    afterCloseRef.current = action;
    keepFocusRef.current = keepFocus;
  };

  const withFocus = (action: () => void) =>
    afterClose(() => editor.focus(action));

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) {
          afterCloseRef.current = null;
          keepFocusRef.current = false;
        }
      }}
      onOpenChangeComplete={(open) => {
        const action = afterCloseRef.current;

        afterCloseRef.current = null;

        if (!open) {
          action?.();
        }
      }}
    >
      <ContextMenuTrigger
        // A grid stretches the content editable to full height. Do not use flex: in Chrome, a click outside a flex parent can focus the editor.
        className="relative grid flex-1 grid-cols-1"
        onContextMenu={(event) => setCellKey(getCellKey(editor, event.target))}
        onTouchStart={(event) => {
          // Long presses keep native text selection outside tables.
          if (getCellKey(editor, event.target) === null) {
            event.preventBaseUIHandler();
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-64"
        finalFocus={() =>
          keepFocusRef.current ? false : (editor.getRootElement() ?? false)
        }
      >
        <ContextMenuItem
          onClick={() =>
            afterClose(
              () => editor.dispatchCommand(OPEN_LINK_FORM_COMMAND, undefined),
              true,
            )
          }
        >
          <Link />
          {selection.isLink ? "Edit link" : "Add link"}
        </ContextMenuItem>
        {selection.isLink && (
          <ContextMenuItem onClick={() => editor.update($removeLink)}>
            <Unlink />
            Remove link
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Type />
            Format
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {TEXT_FORMATS.map(({ format, label, icon: Icon, shortcut }) => (
              <ContextMenuCheckboxItem
                key={format}
                checked={activeFormats.includes(format)}
                onCheckedChange={() =>
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
                }
              >
                <Icon />
                {label}
                {shortcut && (
                  <ContextMenuShortcut>
                    {MODIFIER}
                    {shortcut}
                  </ContextMenuShortcut>
                )}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Pilcrow />
            Paragraph
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {BLOCK_TYPES.map(({ label, icon: Icon, apply }) => (
              <ContextMenuItem key={label} onClick={() => apply(editor)}>
                <Icon />
                {label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Plus />
            Insert
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {INSERTS.map(({ label, icon: Icon, apply }) => (
              <ContextMenuItem key={label} onClick={() => apply(editor)}>
                <Icon />
                {label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {cellKey !== null && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Table />
              Table
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <TableMenuItems
                item={ContextMenuItem}
                onAction={(action) => applyAction(editor, cellKey, action)}
              />
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!canUndo}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        >
          <Undo2 />
          Undo
          <ContextMenuShortcut>{MODIFIER}Z</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!canRedo}
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        >
          <Redo2 />
          Redo
          <ContextMenuShortcut>
            {IS_APPLE ? "⇧⌘Z" : `${MODIFIER}Y`}
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={selection.isCollapsed}
          onClick={() =>
            withFocus(() => editor.dispatchCommand(CUT_COMMAND, null))
          }
        >
          <Scissors />
          Cut
          <ContextMenuShortcut>{MODIFIER}X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={selection.isCollapsed}
          onClick={() =>
            withFocus(() => editor.dispatchCommand(COPY_COMMAND, null))
          }
        >
          <Copy />
          Copy
          <ContextMenuShortcut>{MODIFIER}C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => withFocus(() => paste(editor, false))}>
          <ClipboardPaste />
          Paste
          <ContextMenuShortcut>{MODIFIER}V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => withFocus(() => paste(editor, true))}>
          <TextCursorInput />
          Paste as plain
          <ContextMenuShortcut>
            {IS_APPLE ? "⇧⌘V" : `${MODIFIER}Shift+V`}
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => withFocus(() => editor.update(() => $selectAll()))}
        >
          <TextSelect />
          Select all
          <ContextMenuShortcut>{MODIFIER}A</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
