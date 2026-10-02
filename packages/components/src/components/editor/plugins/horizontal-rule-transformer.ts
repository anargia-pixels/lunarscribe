import type { ElementTransformer } from "@lexical/markdown";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { $createParagraphNode } from "lexical";

export const HORIZONTAL_RULE: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => ($isHorizontalRuleNode(node) ? "---" : null),
  regExp: /^---[ \t]*$/,
  triggerOnEnter: true,
  type: "element",
  replace: (parentNode, _children, _match, isImport) => {
    const rule = $createHorizontalRuleNode();

    parentNode.replace(rule);

    if (!isImport) {
      const paragraph = $createParagraphNode();

      rule.insertAfter(paragraph);
      paragraph.selectStart();
    }
  },
};
