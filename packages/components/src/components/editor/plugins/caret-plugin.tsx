import "./caret-plugin.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, mergeRegister } from "lexical";
import { useEffect, useRef } from "react";

import {
  type CaretAncestors,
  clipCaretRect,
  getCaretAncestors,
  getCaretRect,
} from "./caret-geometry";

export function CaretPlugin() {
  const [editor] = useLexicalComposerContext();
  const caretRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const caret = caretRef.current;
    const container = caret?.parentElement;

    if (!caret || !container) {
      return;
    }

    const document = container.ownerDocument;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const blink = caret.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.2 },
        { opacity: 0, offset: 0.5 },
        { opacity: 1, offset: 0.7 },
        { opacity: 1, offset: 1 },
      ],
      {
        duration: 1250,
        iterations: Number.POSITIVE_INFINITY,
        easing: "ease-out",
      },
    );

    blink.pause();

    let root: HTMLElement | null = null;
    let isDisposed = false;
    let blockCursor: HTMLElement | null = null;
    let frameId: number | undefined;
    let hasPendingBlinkReset = false;
    let lastPosition = "";
    let lastHeight = "";
    let focusElement: Element | null = null;
    let ancestors: CaretAncestors | null = null;

    const hideCaret = () => {
      if (!caret.hidden) {
        caret.hidden = true;
        root?.removeAttribute("data-editor-caret-active");
        blink.pause();
      }
    };

    const updateCaret = () => {
      frameId = undefined;

      const selection = document.getSelection();

      if (
        !root ||
        !editor.isEditable() ||
        editor.isComposing() ||
        !document.hasFocus() ||
        document.activeElement !== root ||
        !selection?.isCollapsed ||
        !editor.getEditorState().read(() => {
          const lexicalSelection = $getSelection();

          return (
            $isRangeSelection(lexicalSelection) &&
            lexicalSelection.isCollapsed()
          );
        })
      ) {
        hideCaret();

        return;
      }

      const nextFocusElement =
        selection.focusNode instanceof Element
          ? selection.focusNode
          : (selection.focusNode?.parentElement ?? null);

      if (!nextFocusElement || !root.contains(nextFocusElement)) {
        hideCaret();

        return;
      }

      if (nextFocusElement !== focusElement) {
        focusElement = nextFocusElement;
        ancestors = getCaretAncestors(nextFocusElement, container);
      }

      const selectionRect = getCaretRect(selection, root, blockCursor);

      const rect =
        selectionRect &&
        ancestors &&
        clipCaretRect(selectionRect, ancestors.clippingElements);

      if (!rect) {
        hideCaret();

        return;
      }

      const containerRect = container.getBoundingClientRect();

      const left =
        rect.left -
        containerRect.left -
        container.clientLeft +
        container.scrollLeft;

      const top =
        rect.top -
        containerRect.top -
        container.clientTop +
        container.scrollTop;

      const position = `translate3d(${left}px, ${top}px, 0)`;
      const height = `${rect.height}px`;
      const wasHidden = caret.hidden;

      const hasRunningAnimation = ancestors?.layoutElements.some((element) =>
        element
          .getAnimations()
          .some((animation) => animation.playState === "running"),
      );

      if (position !== lastPosition) {
        caret.style.transform = position;
        lastPosition = position;
      }

      if (height !== lastHeight) {
        caret.style.height = height;
        lastHeight = height;
      }

      caret.hidden = false;

      if (wasHidden) {
        root.setAttribute("data-editor-caret-active", "");
      }

      if (wasHidden || hasPendingBlinkReset) {
        blink.currentTime = 0;
      }

      hasPendingBlinkReset = false;

      if (reducedMotion.matches) {
        blink.pause();
        blink.currentTime = 0;
      } else if (blink.playState !== "running") {
        blink.play();
      }

      // Follow a moving focused block only for the lifetime of its layout animation.
      if (hasRunningAnimation) {
        scheduleUpdate();
      }
    };

    const scheduleUpdate = () => {
      if (
        !isDisposed &&
        root &&
        (document.activeElement === root || !caret.hidden) &&
        frameId === undefined
      ) {
        frameId = requestAnimationFrame(updateCaret);
      }
    };

    const onSelectionChange = () => {
      hasPendingBlinkReset = true;
      scheduleUpdate();
    };

    const onFocusChange = () => {
      if (document.activeElement !== root) {
        hideCaret();
      }

      scheduleUpdate();
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Block conversion can reparent the same focused text element.
        if (mutation.type === "childList") {
          focusElement = null;
        }

        for (const added of mutation.addedNodes) {
          if (
            added instanceof HTMLElement &&
            added.hasAttribute("data-lexical-cursor")
          ) {
            blockCursor = added;
          }
        }
      }

      if (!blockCursor?.isConnected) {
        blockCursor = null;
      }

      scheduleUpdate();
    });

    const themeObserver = new MutationObserver(() => {
      focusElement = null;
      scheduleUpdate();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    document.addEventListener("scroll", scheduleUpdate, {
      capture: true,
      passive: true,
    });
    document.fonts.addEventListener("loadingdone", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("blur", hideCaret);
    window.addEventListener("focus", scheduleUpdate);
    reducedMotion.addEventListener("change", scheduleUpdate);

    return mergeRegister(
      editor.registerRootListener((nextRoot) => {
        hideCaret();
        mutationObserver.disconnect();
        resizeObserver.disconnect();
        root?.removeEventListener("compositionstart", hideCaret);
        root?.removeEventListener("compositionend", onSelectionChange);
        root = nextRoot;
        focusElement = null;
        blockCursor =
          root?.querySelector<HTMLElement>("[data-lexical-cursor]") ?? null;

        if (root) {
          mutationObserver.observe(root, {
            childList: true,
            subtree: true,
            characterData: true,
          });
          resizeObserver.observe(root);
          resizeObserver.observe(container);
          root.addEventListener("compositionstart", hideCaret);
          root.addEventListener("compositionend", onSelectionChange);
        }

        scheduleUpdate();
      }),
      editor.registerUpdateListener(onSelectionChange),
      editor.registerEditableListener(scheduleUpdate),
      () => {
        isDisposed = true;

        if (frameId !== undefined) {
          cancelAnimationFrame(frameId);
        }

        hideCaret();
        blink.cancel();
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        themeObserver.disconnect();
        root?.removeEventListener("compositionstart", hideCaret);
        root?.removeEventListener("compositionend", onSelectionChange);
        document.removeEventListener("selectionchange", onSelectionChange);
        document.removeEventListener("focusin", onFocusChange);
        document.removeEventListener("focusout", onFocusChange);
        document.removeEventListener("scroll", scheduleUpdate, true);
        document.fonts.removeEventListener("loadingdone", scheduleUpdate);
        window.removeEventListener("resize", scheduleUpdate);
        window.removeEventListener("blur", hideCaret);
        window.removeEventListener("focus", scheduleUpdate);
        reducedMotion.removeEventListener("change", scheduleUpdate);
      },
    );
  }, [editor]);

  return (
    <div
      ref={caretRef}
      data-editor-caret
      aria-hidden="true"
      hidden
      className="bg-foreground pointer-events-none absolute top-0 left-0 z-10 w-px"
    />
  );
}
