import { createDOMRange } from "@lexical/selection";
import {
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $isTextNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
} from "lexical";

export type FindMatch = {
  startKey: NodeKey;
  startOffset: number;
  endKey: NodeKey;
  endOffset: number;
};

type TextSegment = { key: NodeKey; start: number; end: number };

/** Search rendered text across inline formats, keeping blocks separate. */
export function $findMatches(
  query: string,
  matchCase: boolean,
  wholeWord: boolean,
): FindMatch[] {
  if (!query) {
    return [];
  }

  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    matchCase ? "gu" : "giu",
  );

  const matches: FindMatch[] = [];
  let text = "";
  let segments: TextSegment[] = [];

  const flush = () => {
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (
        wholeWord &&
        (/[\p{L}\p{N}\p{M}_]$/u.test(text.slice(0, start)) ||
          /^[\p{L}\p{N}\p{M}_]/u.test(text.slice(end)))
      ) {
        continue;
      }

      const first = segments.find(
        (segment) => segment.start <= start && segment.end > start,
      );

      const last = segments.find(
        (segment) => segment.start < end && segment.end >= end,
      );

      if (first && last) {
        matches.push({
          startKey: first.key,
          startOffset: start - first.start,
          endKey: last.key,
          endOffset: end - last.start,
        });
      }
    }

    text = "";
    segments = [];
  };

  const visit = (node: LexicalNode) => {
    if ($isTextNode(node)) {
      const start = text.length;

      text += node.getTextContent();
      segments.push({ key: node.getKey(), start, end: text.length });

      return;
    }

    if ($isElementNode(node)) {
      const isBlock = !node.isInline();

      if (isBlock) {
        flush();
      }

      for (const child of node.getChildren()) {
        visit(child);
      }

      if (isBlock) {
        flush();
      }

      return;
    }

    // Line breaks and decorators must not join unrelated text into a match.
    flush();
  };

  visit($getRoot());

  return matches;
}

export function $getMatchRange(
  editor: LexicalEditor,
  match: FindMatch,
): Range | null {
  const start = $getNodeByKey(match.startKey);
  const end = $getNodeByKey(match.endKey);

  return start && end
    ? createDOMRange(editor, start, match.startOffset, end, match.endOffset)
    : null;
}
