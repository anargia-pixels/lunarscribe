export type CaretRect = {
  left: number;
  top: number;
  height: number;
};

type CaretClip = {
  element: HTMLElement;
  clipX: boolean;
  clipY: boolean;
};

export type CaretAncestors = {
  layoutElements: HTMLElement[];
  clippingElements: CaretClip[];
};

function getSingleRect(range: Range): CaretRect | null {
  let caretRect: DOMRect | null = null;

  for (const rect of range.getClientRects()) {
    if (rect.height <= 0) {
      continue;
    }

    // Ambiguous positions, such as a bidi boundary, keep the native caret.
    if (
      caretRect &&
      (rect.left !== caretRect.left ||
        rect.top !== caretRect.top ||
        rect.height !== caretRect.height)
    ) {
      return null;
    }

    caretRect = rect;
  }

  return caretRect;
}

export function getCaretRect(
  selection: Selection,
  root: HTMLElement,
  blockCursor: HTMLElement | null,
): CaretRect | null {
  const focusNode = selection.focusNode;

  if (!focusNode || !root.contains(focusNode) || selection.rangeCount !== 1) {
    return null;
  }

  const focusElement =
    focusNode instanceof Element ? focusNode : focusNode.parentElement;

  if (focusElement?.closest('[contenteditable="false"]')) {
    return null;
  }

  if (blockCursor?.isConnected && root.contains(blockCursor)) {
    const rect = blockCursor.getBoundingClientRect();
    const style = getComputedStyle(blockCursor, "::before");
    const height = Number.parseFloat(style.height);

    return height > 0 ? { left: rect.left, top: rect.top, height } : null;
  }

  const range = selection.getRangeAt(0);
  const rect = getSingleRect(range);

  if (rect) {
    return rect;
  }

  // Empty paragraphs have no text rectangle; their existing <br> supplies it.
  // No measurement nodes are inserted into Lexical's editable DOM.
  if (focusNode instanceof HTMLElement && focusNode.childNodes.length === 1) {
    const lineBreak = focusNode.firstChild;

    if (lineBreak instanceof HTMLBRElement) {
      const lineRange = root.ownerDocument.createRange();

      lineRange.selectNode(lineBreak);

      return getSingleRect(lineRange);
    }
  }

  return null;
}

export function getCaretAncestors(
  focusElement: Element,
  container: HTMLElement,
): CaretAncestors {
  const layoutElements: HTMLElement[] = [];
  const clippingElements: CaretClip[] = [];

  for (
    let element = focusElement;
    element !== container;
    element = element.parentElement ?? container
  ) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    layoutElements.push(element);

    const style = getComputedStyle(element);
    const clipX = /auto|scroll|hidden|clip/.test(style.overflowX);
    const clipY = /auto|scroll|hidden|clip/.test(style.overflowY);

    if (clipX || clipY) {
      clippingElements.push({ element, clipX, clipY });
    }
  }

  return { layoutElements, clippingElements };
}

export function clipCaretRect(
  caretRect: CaretRect,
  clippingElements: CaretClip[],
): CaretRect | null {
  let top = caretRect.top;
  let bottom = top + caretRect.height;

  for (const { element, clipX, clipY } of clippingElements) {
    const rect = element.getBoundingClientRect();
    const left = rect.left + element.clientLeft;
    const right = left + element.clientWidth;

    if (clipY) {
      top = Math.max(top, rect.top + element.clientTop);
      bottom = Math.min(
        bottom,
        rect.top + element.clientTop + element.clientHeight,
      );
    }

    if (
      (clipX && (caretRect.left < left || caretRect.left >= right)) ||
      bottom <= top
    ) {
      return null;
    }
  }

  return { left: caretRect.left, top, height: bottom - top };
}
