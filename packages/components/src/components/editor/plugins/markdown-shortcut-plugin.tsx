import { $createCodeNode } from "@lexical/code";
import {
  isCodeLanguageLoaded,
  normalizeCodeLanguage,
} from "@lexical/code-prism";
import { CODE, registerMarkdownShortcuts } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $addUpdateTag,
  $createRangeSelection,
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  $setSelection,
  HISTORIC_TAG,
  HISTORY_PUSH_TAG,
  type ElementNode,
} from "lexical";
import { useEffect } from "react";

import { MARKDOWN_TRANSFORMERS } from "./markdown-transformers";
import { $createMermaidNode } from "./mermaid-node";

// Import and export keep Lexical's code transformer; typing requires both fences.
const SHORTCUT_TRANSFORMERS = MARKDOWN_TRANSFORMERS.filter(
  (transformer) => transformer !== CODE,
);

function $getFenceContext() {
  const selection = $getSelection();

  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchor = selection.anchor.getNode();
  const paragraph = $isParagraphNode(anchor) ? anchor : anchor.getParent();

  if (!$isParagraphNode(paragraph) || !$isRootNode(paragraph.getParent())) {
    return null;
  }

  const paragraphs = [paragraph];

  for (const sibling of paragraph.getPreviousSiblings().reverse()) {
    if (!$isParagraphNode(sibling)) {
      break;
    }

    paragraphs.unshift(sibling);
  }

  for (const sibling of paragraph.getNextSiblings()) {
    if (!$isParagraphNode(sibling)) {
      break;
    }

    paragraphs.push(sibling);
  }

  let text = "";
  let caret = 0;

  for (const block of paragraphs) {
    if (block.is(paragraph)) {
      caret = text.length + selection.anchor.offset;

      if ($isTextNode(anchor)) {
        for (const sibling of anchor.getPreviousSiblings()) {
          caret += sibling.getTextContentSize();
        }
      } else {
        caret = text.length;

        for (const child of block
          .getChildren()
          .slice(0, selection.anchor.offset)) {
          caret += child.getTextContentSize();
        }
      }
    }

    text += `${block.getTextContent()}\n`;
  }

  return { paragraphs, text: text.slice(0, -1), caret };
}

function findFence(text: string) {
  const opening = /(?<![\\`])(`{3,})([^\n]*)/.exec(text);

  if (!opening) {
    return null;
  }

  const fence = opening[1];
  const remainder = opening[2];

  if (!fence || remainder === undefined) {
    return null;
  }

  const start = opening.index;
  const contentStart = start + opening[0].length - remainder.length;
  const singleLineEnd = new RegExp("(?<!`)" + fence + "`*(?!`)");
  const inlineClosing = singleLineEnd.exec(remainder);

  if (inlineClosing) {
    return {
      start,
      end: contentStart + inlineClosing.index + inlineClosing[0].length,
      code: remainder.slice(0, inlineClosing.index),
      language: undefined,
    };
  }

  const bodyStart = start + opening[0].length + 1;

  const closing = singleLineEnd.exec(text.slice(bodyStart));

  if (!closing) {
    return null;
  }

  const bodyEnd = bodyStart + closing.index;
  const codeEnd = text[bodyEnd - 1] === "\n" ? bodyEnd - 1 : bodyEnd;
  const label = remainder.trim();

  const language =
    label === "mermaid" ||
    label === "plain" ||
    isCodeLanguageLoaded(normalizeCodeLanguage(label))
      ? label
      : undefined;

  const body = text.slice(bodyStart, Math.max(bodyStart, codeEnd));

  return {
    start,
    end: bodyEnd + closing[0].length,
    // Wrapping existing multiline text must retain its first line, not treat it as metadata.
    code: !language && label ? `${remainder}\n${body}` : body,
    language,
  };
}

function $pointInBlock(block: ElementNode, offset: number) {
  let remaining = offset;

  for (const child of block.getChildren()) {
    const size = child.getTextContentSize();

    if (remaining <= size) {
      if ($isTextNode(child)) {
        return {
          key: child.getKey(),
          offset: remaining,
          type: "text" as const,
        };
      }

      if ($isElementNode(child)) {
        return $pointInBlock(child, remaining);
      }
    }

    remaining -= size;
  }

  return null;
}

function $pointInParagraphs(paragraphs: ElementNode[], offset: number) {
  let remaining = offset;

  for (const paragraph of paragraphs) {
    const size = paragraph.getTextContentSize();

    if (remaining <= size) {
      return $pointInBlock(paragraph, remaining);
    }

    remaining -= size + 1;
  }

  return null;
}

function $renderFence() {
  const context = $getFenceContext();
  const fence = context && findFence(context.text);

  if (!context || !fence) {
    return;
  }

  const start = $pointInParagraphs(context.paragraphs, fence.start);
  const end = $pointInParagraphs(context.paragraphs, fence.end);

  if (!start || !end) {
    return;
  }

  const selection = $createRangeSelection();

  const code =
    fence.language === "mermaid"
      ? $createMermaidNode(fence.code)
      : $createCodeNode(fence.language).append($createTextNode(fence.code));

  selection.anchor.set(start.key, start.offset, start.type);
  selection.focus.set(end.key, end.offset, end.type);
  $setSelection(selection);
  selection.removeText();

  const anchor = selection.anchor.getNode();
  const prefix = $isParagraphNode(anchor) ? anchor : anchor.getParent();
  const suffix = selection.insertParagraph();

  if (!suffix) {
    return;
  }

  suffix.insertBefore(code);

  // The fence lines provide block boundaries, so their line breaks are not content.
  if ($isLineBreakNode(prefix?.getLastChild())) {
    prefix?.getLastChild()?.remove();
  }

  if (prefix?.getTextContent().trim() === "") {
    prefix.remove();
  }

  if ($isLineBreakNode(suffix.getFirstChild())) {
    suffix.getFirstChild()?.remove();
  }

  suffix.selectStart();
  $addUpdateTag(HISTORY_PUSH_TAG);
}

export function MarkdownShortcutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let unregisterShortcuts: (() => void) | undefined;

    const updateShortcuts = () => {
      const context = $getFenceContext();
      const beforeCaret = context?.text.slice(0, context.caret) ?? "";
      const hasFence = /(?<![\\`])`{2,}/.test(beforeCaret);
      const lineStart = beforeCaret.lastIndexOf("\n") + 1;

      // Mermaid retains its opening-fence shortcut and separate source editor.
      const isMermaidOpening =
        /^ {0,3}`{3,}mermaid[ \t]*$/.test(beforeCaret.slice(lineStart)) &&
        !/(?<![\\`])`{2,}/.test(beforeCaret.slice(0, lineStart));

      const paused = hasFence && !isMermaidOpening;

      if (paused) {
        unregisterShortcuts?.();
        unregisterShortcuts = undefined;
      } else if (!unregisterShortcuts) {
        unregisterShortcuts = registerMarkdownShortcuts(
          editor,
          SHORTCUT_TRANSFORMERS,
        );
      }
    };

    const unregisterUpdates = editor.registerUpdateListener(
      ({ editorState, prevEditorState, dirtyElements, dirtyLeaves, tags }) => {
        editorState.read(updateShortcuts);

        if (
          tags.has(HISTORIC_TAG) ||
          editor.isComposing() ||
          (dirtyElements.size === 0 && dirtyLeaves.size === 0)
        ) {
          return;
        }

        const hasCompleteFence = editorState.read(() => {
          const context = $getFenceContext();

          return context !== null && findFence(context.text) !== null;
        });

        const hadCompleteFence = prevEditorState.read(() => {
          const context = $getFenceContext();

          return context !== null && findFence(context.text) !== null;
        });

        // Undo can restore a complete raw fence. Wait for a new pair before rendering again.
        if (hasCompleteFence && !hadCompleteFence) {
          editor.update($renderFence);
        }
      },
    );

    editor.getEditorState().read(updateShortcuts);

    return () => {
      unregisterUpdates();
      unregisterShortcuts?.();
    };
  }, [editor]);

  return null;
}
