import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumnAtNode,
  $insertTableRowAtNode,
  $isTableCellNode,
  $isTableRowNode,
  $isTableSelection,
  TableCellHeaderStates,
  type TableNode,
} from "@lexical/table";
import { mergeRegister } from "@lexical/utils";
import { Button } from "@lunarscribe/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@lunarscribe/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@lunarscribe/components/ui/dropdown-menu";
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  type ElementFormatType,
  type LexicalEditor,
  type NodeKey,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

const ACTIONS = [
  { action: "row-above", label: "Insert row above", variant: "default" },
  { action: "row-below", label: "Insert row below", variant: "default" },
  { action: "column-left", label: "Insert column left", variant: "default" },
  { action: "column-right", label: "Insert column right", variant: "default" },
  { action: "delete-row", label: "Delete row", variant: "destructive" },
  { action: "delete-column", label: "Delete column", variant: "destructive" },
  { action: "delete-table", label: "Delete table", variant: "destructive" },
] as const;

type TableAction = (typeof ACTIONS)[number]["action"];

function TableMenuItems({
  item: Item,
  onAction,
}: {
  item: typeof ContextMenuItem;
  onAction: (action: TableAction) => void;
}) {
  return ACTIONS.map(({ action, label, variant }) => (
    <Item key={action} variant={variant} onClick={() => onAction(action)}>
      {label}
    </Item>
  ));
}

function $getColumnAlignments(table: TableNode): ElementFormatType[] {
  const header = table.getFirstChild();

  if (!$isTableRowNode(header)) {
    return [];
  }

  return header.getChildren().map((cell) => {
    const paragraph = $isTableCellNode(cell) ? cell.getFirstChild() : null;

    return $isElementNode(paragraph) ? paragraph.getFormatType() : "";
  });
}

/** Markdown uses the first row as its header and one alignment per column. */
function $updateTableFormatting(
  table: TableNode,
  alignments: ElementFormatType[],
) {
  if (!table.isAttached()) {
    return;
  }

  for (const [index, row] of table.getChildren().entries()) {
    if (!$isTableRowNode(row)) {
      continue;
    }

    for (const [column, cell] of row.getChildren().entries()) {
      if (!$isTableCellNode(cell)) {
        continue;
      }

      cell.setHeaderStyles(
        index === 0
          ? TableCellHeaderStates.ROW
          : TableCellHeaderStates.NO_STATUS,
        TableCellHeaderStates.ROW,
      );

      for (const paragraph of cell.getChildren()) {
        if ($isElementNode(paragraph)) {
          paragraph.setFormat(alignments[column] ?? "");
        }
      }
    }
  }
}

function getCellKey(
  editor: LexicalEditor,
  target: EventTarget | null,
): NodeKey | null {
  if (!(target instanceof Node) || !editor.getRootElement()?.contains(target)) {
    return null;
  }

  return editor.read(() => {
    const node = $getNearestNodeFromDOMNode(target);

    return node
      ? ($getTableCellNodeFromLexicalNode(node)?.getKey() ?? null)
      : null;
  });
}

function applyAction(
  editor: LexicalEditor,
  cellKey: NodeKey | null,
  action: TableAction,
) {
  if (cellKey === null) {
    return;
  }

  editor.update(() => {
    const cell = $getNodeByKey(cellKey);

    if (!$isTableCellNode(cell) || !cell.isAttached()) {
      return;
    }

    const table = $getTableNodeFromLexicalNodeOrThrow(cell);

    const alignments = $getColumnAlignments(table);

    const columnIndex = $getTableColumnIndexFromTableCellNode(cell);

    // Menu focus can move the DOM selection. Restore the target cell before
    // calling selection-based deletion helpers, even after a right click.
    cell.selectStart();

    switch (action) {
      case "row-above":
        $insertTableRowAtNode(cell, false)?.selectStart();
        break;
      case "row-below":
        $insertTableRowAtNode(cell, true)?.selectStart();
        break;
      case "column-left":
        $insertTableColumnAtNode(cell, false)?.selectStart();
        alignments.splice(columnIndex, 0, alignments[columnIndex] ?? "");
        break;
      case "column-right":
        $insertTableColumnAtNode(cell, true)?.selectStart();
        alignments.splice(columnIndex + 1, 0, alignments[columnIndex] ?? "");
        break;
      case "delete-row":
        $deleteTableRowAtSelection();
        break;
      case "delete-column":
        $deleteTableColumnAtSelection();
        alignments.splice(columnIndex, 1);
        break;
      case "delete-table":
        table.selectPrevious();
        table.remove();
        break;
    }

    $updateTableFormatting(table, alignments);
  });
}

export function TableCellMenuPlugin({ children }: { children: ReactNode }) {
  const [editor] = useLexicalComposerContext();
  const [cellKey, setCellKey] = useState<NodeKey | null>(null);
  const contextCellKey = useRef<NodeKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateCell = () => {
      const selection = $getSelection();

      const cell =
        $isRangeSelection(selection) || $isTableSelection(selection)
          ? $getTableCellNodeFromLexicalNode(selection.anchor.getNode())
          : null;

      setCellKey(cell?.getKey() ?? null);
    };

    editor.read(updateCell);

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(updateCell),
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateCell();

          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  useEffect(() => {
    const cell = cellKey === null ? null : editor.getElementByKey(cellKey);
    const container = containerRef.current;
    const button = buttonRef.current;

    if (!cell || !container || !button) {
      return;
    }

    const positionButton = () => {
      const cellRect = cell.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Geometry follows the selected cell; appearance stays in Tailwind.
      button.style.left = `${cellRect.right - containerRect.left - button.offsetWidth}px`;
      button.style.top = `${cellRect.top - containerRect.top}px`;
    };

    positionButton();

    const observer = new ResizeObserver(positionButton);

    observer.observe(cell);
    observer.observe(container);
    container.addEventListener("scroll", positionButton, true);
    window.addEventListener("resize", positionButton);

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", positionButton, true);
      window.removeEventListener("resize", positionButton);
    };
  }, [cellKey, editor]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={containerRef}
        className="relative flex flex-1 flex-col"
        onContextMenu={(event) => {
          contextCellKey.current = getCellKey(editor, event.target);

          if (contextCellKey.current === null) {
            event.preventBaseUIHandler();
            event.stopPropagation();
          }
        }}
        onTouchStart={(event) => {
          contextCellKey.current = getCellKey(editor, event.target);

          if (contextCellKey.current === null) {
            event.preventBaseUIHandler();
          }
        }}
      >
        {children}
        {cellKey !== null && (
          <div
            ref={buttonRef}
            className="absolute z-10 p-1"
            contentEditable={false}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label="Table cell actions"
                  />
                }
              >
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                finalFocus={() => editor.getRootElement() ?? false}
              >
                <TableMenuItems
                  item={DropdownMenuItem}
                  onAction={(action) => applyAction(editor, cellKey, action)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent finalFocus={() => editor.getRootElement() ?? false}>
        <TableMenuItems
          item={ContextMenuItem}
          onAction={(action) =>
            applyAction(editor, contextCellKey.current, action)
          }
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
