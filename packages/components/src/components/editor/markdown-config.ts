import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString } from "@lexical/markdown";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";

import { editorTheme } from "./editor-theme";
import { MARKDOWN_TRANSFORMERS } from "./plugins/markdown-transformers";
import { MathNode } from "./plugins/math-node";
import { MermaidNode } from "./plugins/mermaid-node";

/** The editor and export preview use the same markdown rendering. */
export function createMarkdownConfig(markdown: string): InitialConfigType {
  return {
    namespace: "lunarscribe",
    theme: editorTheme,
    nodes: [
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
    ],
    editorState: () =>
      $convertFromMarkdownString(
        markdown,
        MARKDOWN_TRANSFORMERS,
        undefined,
        true,
      ),
    onError: (error) => {
      throw error;
    },
  };
}
