import type {
  ElementTransformer,
  MultilineElementTransformer,
  TextMatchTransformer,
} from "@lexical/markdown";
import {
  $createNodeSelection,
  $createParagraphNode,
  $isParagraphNode,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
} from "lexical";

import { $createMathNode, $isMathNode, MathNode } from "./math-node";

// Escaped dollars, double dollars, whitespace at the delimiters, and currency
// such as "$5 and $10" are left as ordinary text.
const INLINE_MATH_REG_EXP =
  /(?<![\\$])\$(?![\s$])((?:\\[^\n]|[^$\\\n])+?)(?<!\s)\$(?![$\d])/;

const BLOCK_MATH_END_REG_EXP = /(?<!\\)\$\$[ \t]*$/;

// While typing LaTeX, keep markdown shortcuts from consuming its operators
// before the closing dollars can turn the source into a math node.
export const MATH_SOURCE_SHORTCUTS: TextMatchTransformer[] = [
  "*",
  "_",
  "~",
  "^",
  "`",
  "=",
  ")",
].map((trigger) => ({
  dependencies: [],
  type: "text-match",
  trigger,
  regExp: /^(?:[^$\\\n]|\\.)*\${1,2}(?!\$)(?:\\.|[^$\\\n])*$/,
  replace: (node) => {
    node.selectEnd();
  },
}));

/** A complete single-line block renders as soon as its closing `$$` is typed. */
export const BLOCK_MATH_END: TextMatchTransformer = {
  dependencies: [MathNode],
  type: "text-match",
  trigger: "$",
  regExp: /^ {0,3}\$\$((?:\\[^\n]|[^$\\\n])*?)\$\$$/,
  replace: (node, match) => {
    const parent = node.getParent();

    if (
      !$isParagraphNode(parent) ||
      !$isRootOrShadowRoot(parent.getParent()) ||
      parent.getChildrenSize() !== 1
    ) {
      return;
    }

    const math = $createMathNode(match[1] ?? "", false);
    const paragraph = $createParagraphNode();

    parent.replace(math);
    math.insertAfter(paragraph);
    paragraph.select();
  },
};

export const INLINE_MATH: TextMatchTransformer = {
  dependencies: [MathNode],
  type: "text-match",
  trigger: "$",
  importRegExp: INLINE_MATH_REG_EXP,
  regExp: new RegExp(`${INLINE_MATH_REG_EXP.source}$`),
  replace: (node, match) => {
    node.replace($createMathNode(match[1] ?? ""));
  },
  export: (node, _traverseChildren, exportFormat) => {
    if ($isMathNode(node)) {
      return node.isInline() ? node.getTextContent() : null;
    }

    if (!$isTextNode(node) || node.hasFormat("code")) {
      return null;
    }

    const text = node.getTextContent();

    // Lexical's default exporter does not escape these math delimiters.
    const encoded = text.replace(/[$^]/g, (marker) =>
      marker === "$" ? "&#36;" : "&#94;",
    );

    return encoded === text ? null : exportFormat(node, encoded);
  },
};

/** Import a complete block only; an unfinished fence stays editable markdown. */
export const BLOCK_MATH: MultilineElementTransformer = {
  dependencies: [MathNode],
  type: "multiline-element",
  regExpStart: /^ {0,3}\$\$/,
  regExpEnd: BLOCK_MATH_END_REG_EXP,
  replace: () => false,
  handleImportAfterStartMatch: ({
    lines,
    rootNode,
    startLineIndex,
    startMatch,
  }) => {
    const firstLine = lines[startLineIndex];

    if (firstLine === undefined) {
      return null;
    }

    const equationLines = [firstLine.slice(startMatch[0].length)];

    for (let index = startLineIndex; index < lines.length; index++) {
      const line = index === startLineIndex ? equationLines[0] : lines[index];
      const closing = line?.match(BLOCK_MATH_END_REG_EXP);

      if (closing && line !== undefined) {
        if (index === startLineIndex) {
          equationLines[0] = line.slice(0, closing.index);
        } else {
          equationLines.push(line.slice(0, closing.index));
        }

        // Remove fence-only lines, preserving indentation and blank lines in LaTeX.
        if (equationLines[0]?.trim() === "") {
          equationLines.shift();
        }

        if (equationLines.at(-1)?.trim() === "") {
          equationLines.pop();
        }

        rootNode.append($createMathNode(equationLines.join("\n"), false));

        return [true, index];
      }

      if (index !== startLineIndex && line !== undefined) {
        equationLines.push(line);
      }
    }

    return null;
  },
  export: (node) =>
    $isMathNode(node) && !node.isInline() ? node.getTextContent() : null,
};

/** `$$` followed by Enter opens an empty block ready for multiline LaTeX. */
export const BLOCK_MATH_SHORTCUT: ElementTransformer = {
  dependencies: [MathNode],
  type: "element",
  regExp: /^ {0,3}\$\$(?:([^\n]*?)\$\$)?[ \t]*$/,
  triggerOnEnter: true,
  export: () => null,
  replace: (parent, children, match, isImport) => {
    if (isImport) {
      const text = children[0];

      // Lexical removes the matched prefix before calling an element importer.
      // Restore it when this typing-only shortcut declines an unfinished fence.
      if ($isTextNode(text)) {
        text.setTextContent(match[0] ?? "");
      }

      return false;
    }

    if (!$isParagraphNode(parent) || !$isRootOrShadowRoot(parent.getParent())) {
      return false;
    }

    const math = $createMathNode(match[1] ?? "", false);
    const selection = $createNodeSelection();

    parent.replace(math);
    selection.add(math.getKey());
    $setSelection(selection);
  },
};
