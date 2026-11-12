import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkExtension, LinkNode } from "@lexical/link";
import {
  CheckListExtension,
  ListExtension,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { $convertFromMarkdownString } from "@lexical/markdown";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  TableCellNode,
  TableExtension,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { configExtension, defineExtension } from "lexical";

import { editorTheme } from "./editor-theme";
import { parseFrontmatter } from "./frontmatter";
import { CheckListReorderExtension } from "./plugins/check-list-reorder-extension";
import { CodeHighlightExtension } from "./plugins/code-highlight-plugin";
import { ImageNode } from "./plugins/image-node";
import { MARKDOWN_TRANSFORMERS } from "./plugins/markdown-transformers";
import { MathNode } from "./plugins/math-node";
import { MermaidNode } from "./plugins/mermaid-node";

const MARKDOWN_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  HorizontalRuleNode,
  MathNode,
  MermaidNode,
  ImageNode,
];

/** Frontmatter belongs to the frontmatter panel, not to the editor graph. */
function $importMarkdown(markdown: string) {
  $convertFromMarkdownString(
    parseFrontmatter(markdown).body,
    MARKDOWN_TRANSFORMERS,
    undefined,
    true,
  );
}

function throwError(error: Error): never {
  throw error;
}

/** The export preview renders markdown the same way as the editor. */
export function createMarkdownConfig(markdown: string): InitialConfigType {
  return {
    namespace: "lunarscribe",
    theme: editorTheme,
    nodes: MARKDOWN_NODES,
    editorState: () => $importMarkdown(markdown),
    onError: throwError,
  };
}

/**
 * The editor's nodes and the behaviour that registers node transforms. A
 * transform registered after the markdown loads marks every node of its type
 * dirty and reprocesses the whole buffer; extensions register before the
 * initial state, so opening a buffer runs each transform once.
 */
export function createMarkdownExtension(markdown: string) {
  return defineExtension({
    name: "lunarscribe/markdown",
    namespace: "lunarscribe",
    theme: editorTheme,
    nodes: MARKDOWN_NODES,
    dependencies: [
      ListExtension,
      configExtension(CheckListExtension, { disableTakeFocusOnClick: true }),
      CheckListReorderExtension,
      configExtension(TableExtension, {
        hasCellMerge: false,
        hasCellBackgroundColor: false,
        hasHorizontalScroll: true,
      }),
      CodeHighlightExtension,
      LinkExtension,
    ],
    $initialEditorState: () => $importMarkdown(markdown),
    onError: throwError,
  });
}
