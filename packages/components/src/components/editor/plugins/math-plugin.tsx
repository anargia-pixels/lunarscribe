import "./math-plugin.css";
import { $isCodeNode } from "@lexical/code";
import { $generateNodesFromMarkdownString } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $addUpdateTag,
  $createNodeSelection,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  createCommand,
  HISTORY_PUSH_TAG,
  type LexicalNode,
  mergeRegister,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";

import { MARKDOWN_TRANSFORMERS } from "./markdown-transformers";
import { $createMathNode, $isMathNode, MathNode } from "./math-node";

/** `true` inserts inline math; `false` inserts a standalone math block. */
export const INSERT_MATH_COMMAND = createCommand<boolean>(
  "INSERT_MATH_COMMAND",
);

function $hasMathFormatting(nodes: LexicalNode[]): boolean {
  return nodes.some(
    (node) =>
      $isMathNode(node) ||
      ($isTextNode(node) &&
        (node.hasFormat("superscript") || node.hasFormat("subscript"))) ||
      ($isElementNode(node) && $hasMathFormatting(node.getChildren())),
  );
}

export function MathPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([MathNode])) {
      throw new Error("MathPlugin requires MathNode to be registered.");
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_MATH_COMMAND,
        (inline) => {
          if (!editor.isEditable()) {
            return false;
          }

          const selection = $getSelection() ?? $getRoot().selectEnd();

          const equation = $isRangeSelection(selection)
            ? selection.getTextContent()
            : "";

          const math = $createMathNode(equation, inline);
          const mathSelection = $createNodeSelection();

          $insertNodes([math]);

          mathSelection.add(math.getKey());
          $setSelection(mathSelection);
          $addUpdateTag(HISTORY_PUSH_TAG);

          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (
            !(event instanceof ClipboardEvent) ||
            !editor.isEditable() ||
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement
          ) {
            return false;
          }

          const clipboard = event.clipboardData;
          const selection = $getSelection();

          if (
            !clipboard ||
            clipboard.types.includes("application/x-lexical-editor") ||
            !$isRangeSelection(selection)
          ) {
            return false;
          }

          const anchor = selection.anchor.getNode();

          if (
            $isCodeNode(anchor) ||
            $isCodeNode(anchor.getParent()) ||
            ($isTextNode(anchor) && anchor.hasFormat("code")) ||
            selection.hasFormat("code")
          ) {
            return false;
          }

          // Browser code snippets also carry HTML. Parse their plain markdown
          // before the default HTML paste can turn LaTeX into ordinary text.
          const markdown = clipboard.getData("text/plain");

          if (!/[$^~]/.test(markdown)) {
            return false;
          }

          const nodes = $generateNodesFromMarkdownString(
            markdown,
            MARKDOWN_TRANSFORMERS,
          );

          if (!$hasMathFormatting(nodes)) {
            return false;
          }

          event.preventDefault();
          $insertNodes(nodes);

          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);

  return null;
}
