import type { ElementTransformer } from "@lexical/markdown";
import { $isTextNode } from "lexical";

import {
  $createAlertQuoteNode,
  $isAlertQuoteNode,
  AlertQuoteNode,
  parseQuoteAlert,
} from "./alert-quote-node";

/**
 * `> [!NOTE]`, `> [!WARNING]` or `> [!CAUTION]` on a line of its own starts an alert quote.
 * Export writes the marker back, then every line of the quote after `> `.
 */
export const ALERT_QUOTE: ElementTransformer = {
  dependencies: [AlertQuoteNode],
  export: (node, exportChildren) => {
    if (!$isAlertQuoteNode(node)) {
      return null;
    }

    const lines = exportChildren(node)
      .split("\n")
      .map((line) => `> ${line}`);

    return [`> [!${node.getAlert().toUpperCase()}]`, ...lines].join("\n");
  },
  regExp: /^>[ \t]*\[!(NOTE|WARNING|CAUTION)\][ \t]*$/i,
  replace: (parentNode, _children, match, isImport) => {
    const alert = parseQuoteAlert(match[1]);

    if (!isImport || alert === null) {
      return false;
    }

    parentNode.replace($createAlertQuoteNode(alert));
  },
  type: "element",
};

/**
 * The first `> ` line after the marker fills the still-empty alert directly.
 * Lexical's QUOTE would start it with a line break; later lines go through QUOTE.
 */
export const ALERT_QUOTE_FIRST_LINE: ElementTransformer = {
  dependencies: [AlertQuoteNode],
  export: () => null,
  regExp: /^>\s/,
  replace: (parentNode, children, _match, isImport) => {
    const previous = parentNode.getPreviousSibling();

    if (!isImport || !$isAlertQuoteNode(previous) || !previous.isEmpty()) {
      return false;
    }

    previous.append(...children);
    parentNode.remove();
  },
  type: "element",
};

/** Typing `[!NOTE] `, `[!WARNING] ` or `[!CAUTION] ` at the start of a block turns it into that alert quote. */
export const ALERT_QUOTE_SHORTCUT: ElementTransformer = {
  dependencies: [AlertQuoteNode],
  export: () => null,
  regExp: /^\[!(NOTE|WARNING|CAUTION)\]\s/i,
  replace: (parentNode, children, match, isImport) => {
    const alert = parseQuoteAlert(match[1]);

    // A markdown line that merely starts with the marker stays text. Lexical has
    // already cut the match from it, so the match goes back in front, as MERMAID_SHORTCUT does.
    if (isImport || alert === null) {
      const [text] = children;

      if ($isTextNode(text)) {
        text.setTextContent(`${match[0] ?? ""}${text.getTextContent()}`);
      }

      return false;
    }

    const node = $createAlertQuoteNode(alert);

    node.append(...children);
    parentNode.replace(node);
    node.select(0, 0);
  },
  type: "element",
};
