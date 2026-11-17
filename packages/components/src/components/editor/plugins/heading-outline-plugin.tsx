import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isHeadingNode } from "@lexical/rich-text";
import {
  $getSelection,
  $isRangeSelection,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
} from "lexical";
import { useEffect, useEffectEvent } from "react";

import {
  $getHeadingAnchors,
  goToHeading,
  type HeadingAnchor,
} from "../heading-anchors";

/**
 * The buffer's headings, the heading of the active section (the caret's or the
 * one scrolled to; null above the first heading), and a way to jump to one.
 */
export type Outline = {
  headings: HeadingAnchor[];
  activeKey: NodeKey | null;
  goToHeading: (key: NodeKey) => void;
};

/**
 * The heading of the section holding the caret: the caret's block when it is
 * a heading, else the nearest heading above it. Undefined without a selection,
 * such as while the editor is blurred, so the last section stays active.
 */
function $getActiveHeadingKey(): NodeKey | null | undefined {
  const selection = $getSelection();

  const node = $isRangeSelection(selection)
    ? selection.anchor.getNode()
    : selection?.getNodes()[0];

  if (node === undefined) {
    return undefined;
  }

  for (
    let block: LexicalNode | null = node.getTopLevelElement();
    block !== null;
    block = block.getPreviousSibling()
  ) {
    if ($isHeadingNode(block)) {
      return block.getKey();
    }
  }

  return null;
}

/** Whether the selection differs between two editor states. */
function hasSelectionMoved(next: EditorState, previous: EditorState) {
  const selection = next.read($getSelection);
  const previousSelection = previous.read($getSelection);

  return selection === null
    ? previousSelection !== null
    : !selection.is(previousSelection);
}

/** The closest ancestor that scrolls vertically, which the editor scrolls inside. */
function scrollParent(element: HTMLElement) {
  for (
    let ancestor = element.parentElement;
    ancestor !== null;
    ancestor = ancestor.parentElement
  ) {
    const { overflowY } = getComputedStyle(ancestor);

    if (overflowY === "auto" || overflowY === "scroll") {
      return ancestor;
    }
  }

  return null;
}

/**
 * The heading of the section at the top of the viewport: the last heading
 * above a line a third of the way down. Scrolled to the bottom, the last
 * heading in view wins, since a short last section never reaches that line.
 */
function headingAtTop(
  editor: LexicalEditor,
  headings: HeadingAnchor[],
  viewport: HTMLElement | null,
) {
  if (viewport === null) {
    return null;
  }

  const bounds = viewport.getBoundingClientRect();

  const isAtBottom =
    viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;

  const line = isAtBottom ? bounds.bottom : bounds.top + bounds.height / 3;
  let key: NodeKey | null = null;

  for (const heading of headings) {
    const element = editor.getElementByKey(heading.key);

    // Headings inside a collapsed section have no box to measure.
    if (element === null || element.getClientRects().length === 0) {
      continue;
    }

    if (element.getBoundingClientRect().top > line) {
      break;
    }

    key = heading.key;
  }

  return key;
}

/**
 * Reports the outline whenever the headings or the active section change, and
 * null on unmount. The active section follows the caret when it moves and the
 * scroll position when the editor scrolls.
 */
export function HeadingOutlinePlugin({
  onChange,
}: {
  onChange: (outline: Outline | null) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const report = useEffectEvent(onChange);

  useEffect(() => {
    let previous = "";
    let headings: HeadingAnchor[] = [];
    let activeKey: NodeKey | null = null;
    let viewport: HTMLElement | null = null;
    let frame = 0;

    const goTo = (key: NodeKey) => {
      goToHeading(editor, key);
      editor.focus();
    };

    const publish = () => {
      const next = JSON.stringify([headings, activeKey]);

      if (next !== previous) {
        previous = next;
        report({ headings, activeKey, goToHeading: goTo });
      }
    };

    const followCaret = () => {
      activeKey = editor.read($getActiveHeadingKey) ?? activeKey;
    };

    const followScroll = () => {
      activeKey = headingAtTop(editor, headings, viewport);
      publish();
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(followScroll);
    };

    headings = editor.read($getHeadingAnchors);
    followCaret();
    publish();

    // Whichever moved last decides the active section: the caret, or the scroll.
    const unregisterUpdate = editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
        const isDirty = dirtyElements.size > 0 || dirtyLeaves.size > 0;

        // Selection-only updates move the caret but cannot change the headings.
        if (isDirty) {
          headings = editor.read($getHeadingAnchors);
        }

        // Other updates leave the caret alone, so a scrolled-to section stays active.
        if (isDirty || hasSelectionMoved(editorState, prevEditorState)) {
          followCaret();
        }

        publish();
      },
    );

    const unregisterRoot = editor.registerRootListener((root) => {
      viewport?.removeEventListener("scroll", onScroll);
      viewport = root && scrollParent(root);
      viewport?.addEventListener("scroll", onScroll, { passive: true });
    });

    return () => {
      unregisterUpdate();
      unregisterRoot();
      viewport?.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      report(null);
    };
  }, [editor]);

  return null;
}
