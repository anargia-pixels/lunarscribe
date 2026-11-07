import type {
  ElementTransformer,
  TextMatchTransformer,
} from "@lexical/markdown";
import {
  $createParagraphNode,
  $isParagraphNode,
  $isRootNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from "lexical";

import {
  MARKDOWN_IMAGE_LINE,
  parseImageLine,
  WIKILINK_IMAGE_LINE,
} from "./image-markdown";
import { $createImageNode, $isImageNode, ImageNode } from "./image-node";

/** Replaces a top-level paragraph holding only `line` with an image block. */
function $replaceWithImage(paragraph: ElementNode, line: string) {
  const embed = parseImageLine(line);

  if (!embed || !$isRootNode(paragraph.getParent())) {
    return null;
  }

  const image = $createImageNode(embed);

  paragraph.replace(image);

  return image;
}

function replaceLine(
  parent: ElementNode,
  children: LexicalNode[],
  match: string[],
  isImport: boolean,
) {
  // Typing is handled by the shortcuts below, as soon as the embed closes.
  if (!isImport) {
    return false;
  }

  if ($replaceWithImage(parent, match[0]!)) {
    return;
  }

  // The importer already cut the matched text; put it back so the line stays text.
  const text = children[0];

  if ($isTextNode(text)) {
    text.setTextContent(match[0]!);
  }

  return false;
}

/** A line holding only `![[photo.png]]` is an image block. */
export const WIKILINK_IMAGE: ElementTransformer = {
  dependencies: [ImageNode],
  type: "element",
  regExp: WIKILINK_IMAGE_LINE,
  replace: replaceLine,
  export: (node) => ($isImageNode(node) ? node.getTextContent() : null),
};

/** A line holding only `![alt](photo.png)` is an image block. */
export const MARKDOWN_IMAGE: ElementTransformer = {
  dependencies: [ImageNode],
  type: "element",
  regExp: MARKDOWN_IMAGE_LINE,
  replace: replaceLine,
  export: () => null,
};

function $replaceTypedEmbed(text: TextNode) {
  const paragraph = text.getParent();

  if (
    !$isParagraphNode(paragraph) ||
    paragraph.getTextContent() !== text.getTextContent()
  ) {
    return;
  }

  const image = $replaceWithImage(paragraph, text.getTextContent());

  if (image) {
    const next = $createParagraphNode();

    image.insertAfter(next);
    next.select();
  }
}

/** Typing the closing `]]` of an embed alone on its line turns it into an image block. */
export const WIKILINK_IMAGE_SHORTCUT: TextMatchTransformer = {
  dependencies: [ImageNode],
  type: "text-match",
  trigger: "]",
  regExp: /!\[\[[^[\]\n]+\]\]$/u,
  replace: $replaceTypedEmbed,
};

/**
 * Typing the closing `)` of `![alt](target)` alone on its line turns it into an image
 * block. It runs before the link shortcut, so the `!` never stays before a link.
 */
export const MARKDOWN_IMAGE_SHORTCUT: TextMatchTransformer = {
  dependencies: [ImageNode],
  type: "text-match",
  trigger: ")",
  regExp: /!\[[^[\]\n]*\]\((?:<[^<>\n]+>|[^\s()<>]+)(?:\s+"[^"\n]*")?\)$/u,
  replace: $replaceTypedEmbed,
};
