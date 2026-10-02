import {
  $generateNodesFromMarkdownString,
  type MultilineElementTransformer,
} from "@lexical/markdown";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $isElementNode,
  type ElementFormatType,
  type ElementNode,
} from "lexical";

import { INLINE_TRANSFORMERS } from "./inline-transformers";

const TABLE_ROW_REG_EXP = /^ {0,3}\S.*\|/;

/** Split on unescaped pipes, including optional outer pipes. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  const text = line.trim();
  let cell = "";

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const next = text[index + 1];

    if (character === "\\" && (next === "|" || next === "\\")) {
      cell += next === "|" ? "|" : "\\\\";
      index++;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell.trim());

  if (text.startsWith("|")) {
    cells.shift();
  }

  if (cell === "" && text.endsWith("|")) {
    cells.pop();
  }

  return cells;
}

function getAlignment(delimiter: string): ElementFormatType {
  if (delimiter.startsWith(":")) {
    return delimiter.endsWith(":") ? "center" : "left";
  }

  return delimiter.endsWith(":") ? "right" : "";
}

function getDelimiter(alignment: ElementFormatType): string {
  switch (alignment) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
  }
}

function formatRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function $exportCell(
  cell: TableCellNode | undefined,
  traverseChildren: (node: ElementNode) => string,
): string {
  if (!cell) {
    return "";
  }

  const markdown = cell
    .getChildren()
    .map((child) =>
      $isElementNode(child) ? traverseChildren(child) : child.getTextContent(),
    )
    .join("<br>");

  return markdown.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function $createCellParagraph(markdown: string, alignment: ElementFormatType) {
  const paragraph = $createParagraphNode().setFormat(alignment);

  for (const node of $generateNodesFromMarkdownString(
    markdown,
    INLINE_TRANSFORMERS,
  )) {
    if ($isElementNode(node)) {
      paragraph.append(...node.getChildren());
    }
  }

  // Decode exported line breaks after inline parsing so `<br>` inside code
  // stays literal and formats spanning a line break remain intact.
  for (const textNode of paragraph.getAllTextNodes()) {
    if (textNode.hasFormat("code")) {
      continue;
    }

    const breaks = [...textNode.getTextContent().matchAll(/<br\s*\/?>/gi)];

    if (breaks.length === 0) {
      continue;
    }

    const offsets = breaks.flatMap((match) => [
      match.index,
      match.index + match[0].length,
    ]);

    for (const fragment of textNode.splitText(...offsets)) {
      if (/^<br\s*\/?>$/i.test(fragment.getTextContent())) {
        fragment.replace($createLineBreakNode());
      }
    }
  }

  return paragraph;
}

export const TABLE: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  regExpStart: TABLE_ROW_REG_EXP,
  // A single typed row is incomplete; only the import handler builds tables.
  replace: () => false,
  type: "multiline-element",
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    const headerLine = lines[startLineIndex];
    const delimiterLine = lines[startLineIndex + 1];

    if (headerLine === undefined || delimiterLine === undefined) {
      return null;
    }

    const headers = splitRow(headerLine);
    const delimiters = splitRow(delimiterLine);

    if (
      headers.length === 0 ||
      headers.length !== delimiters.length ||
      !delimiters.every((cell) => /^:?-+:?$/.test(cell))
    ) {
      return null;
    }

    const rows = [headers];
    let lastLineIndex = startLineIndex + 1;

    for (let index = startLineIndex + 2; index < lines.length; index++) {
      const line = lines[index];

      if (line === undefined || !TABLE_ROW_REG_EXP.test(line)) {
        break;
      }

      rows.push(splitRow(line));
      lastLineIndex = index;
    }

    const columns = Math.max(...rows.map((row) => row.length));
    const table = $createTableNode();

    for (const [rowIndex, cells] of rows.entries()) {
      const row = $createTableRowNode();

      for (let column = 0; column < columns; column++) {
        const cell = $createTableCellNode(
          rowIndex === 0
            ? TableCellHeaderStates.ROW
            : TableCellHeaderStates.NO_STATUS,
        );

        cell.append(
          $createCellParagraph(
            cells[column] ?? "",
            getAlignment(delimiters[column] ?? "---"),
          ),
        );
        row.append(cell);
      }

      table.append(row);
    }

    rootNode.append(table);

    return [true, lastLineIndex];
  },
  export: (node, traverseChildren) => {
    if (!$isTableNode(node)) {
      return null;
    }

    const rows = node
      .getChildren()
      .flatMap((row) =>
        $isTableRowNode(row)
          ? [row.getChildren().filter($isTableCellNode)]
          : [],
      );

    const header = rows[0];

    if (!header || header.length === 0) {
      return "";
    }

    const columns = Math.max(...rows.map((row) => row.length));
    const output: string[] = [];

    for (const [rowIndex, cells] of rows.entries()) {
      const values: string[] = [];
      const delimiters: string[] = [];

      for (let column = 0; column < columns; column++) {
        const cell = cells[column];

        values.push($exportCell(cell, traverseChildren));

        if (rowIndex === 0) {
          const paragraph = cell?.getFirstChild();

          delimiters.push(
            getDelimiter(
              $isElementNode(paragraph) ? paragraph.getFormatType() : "",
            ),
          );
        }
      }

      output.push(formatRow(values));

      if (rowIndex === 0) {
        output.push(formatRow(delimiters));
      }
    }

    return output.join("\n");
  },
};
