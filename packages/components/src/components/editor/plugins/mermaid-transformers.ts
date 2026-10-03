import type {
  ElementTransformer,
  MultilineElementTransformer,
} from "@lexical/markdown";
import {
  $createNodeSelection,
  $isParagraphNode,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
} from "lexical";

import {
  $createMermaidNode,
  $isMermaidNode,
  MermaidNode,
} from "./mermaid-node";

const MERMAID_START = /^ {0,3}(`{3,}|~{3,})mermaid[ \t]*$/;

export const MERMAID: MultilineElementTransformer = {
  dependencies: [MermaidNode],
  type: "multiline-element",
  regExpStart: MERMAID_START,
  replace: () => false,
  handleImportAfterStartMatch: ({
    lines,
    rootNode,
    startLineIndex,
    startMatch,
  }) => {
    const fence = startMatch[1];

    if (!fence) {
      return null;
    }

    const closing = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);

    for (let index = startLineIndex + 1; index < lines.length; index++) {
      if (closing.test(lines[index] ?? "")) {
        rootNode.append(
          $createMermaidNode(lines.slice(startLineIndex + 1, index).join("\n")),
        );

        return [true, index];
      }
    }

    return null;
  },
  export: (node) => ($isMermaidNode(node) ? node.getTextContent() : null),
};

/** An opening Mermaid fence followed by Enter opens a block for editing. */
export const MERMAID_SHORTCUT: ElementTransformer = {
  dependencies: [MermaidNode],
  type: "element",
  regExp: MERMAID_START,
  triggerOnEnter: true,
  export: () => null,
  replace: (parent, children, match, isImport) => {
    if (isImport) {
      const text = children[0];

      if ($isTextNode(text)) {
        text.setTextContent(match[0] ?? "");
      }

      return false;
    }

    if (!$isParagraphNode(parent) || !$isRootOrShadowRoot(parent.getParent())) {
      return false;
    }

    const node = $createMermaidNode();
    const selection = $createNodeSelection();

    parent.replace(node);
    selection.add(node.getKey());
    $setSelection(selection);
  },
};
