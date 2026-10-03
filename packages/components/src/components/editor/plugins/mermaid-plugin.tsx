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
import {
  $createMermaidNode,
  $isMermaidNode,
  MermaidNode,
} from "./mermaid-node";

export const INSERT_MERMAID_COMMAND = createCommand<void>(
  "INSERT_MERMAID_COMMAND",
);

function $hasMermaid(nodes: LexicalNode[]): boolean {
  return nodes.some(
    (node) =>
      $isMermaidNode(node) ||
      ($isElementNode(node) && $hasMermaid(node.getChildren())),
  );
}

export function MermaidPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([MermaidNode])) {
      throw new Error("MermaidPlugin requires MermaidNode to be registered.");
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_MERMAID_COMMAND,
        () => {
          if (!editor.isEditable()) {
            return false;
          }

          const selection = $getSelection() ?? $getRoot().selectEnd();

          const code = $isRangeSelection(selection)
            ? selection.getTextContent()
            : "";

          const node = $createMermaidNode(
            code || "flowchart TD\n    A[Start] --> B[End]",
          );

          const nodeSelection = $createNodeSelection();

          $insertNodes([node]);
          nodeSelection.add(node.getKey());
          $setSelection(nodeSelection);
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

          const markdown = clipboard.getData("text/plain");

          if (!markdown.includes("mermaid")) {
            return false;
          }

          const nodes = $generateNodesFromMarkdownString(
            markdown,
            MARKDOWN_TRANSFORMERS,
          );

          if (!$hasMermaid(nodes)) {
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
