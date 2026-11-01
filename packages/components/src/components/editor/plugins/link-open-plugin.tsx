import { $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import { Kbd, KbdGroup } from "@lunarscribe/components/ui/kbd";
import { Tooltip, TooltipContent } from "@lunarscribe/components/ui/tooltip";
import {
  $getNearestNodeFromDOMNode,
  IS_APPLE,
  type LexicalEditor,
  type NodeKey,
} from "lexical";
import { useEffect, useState } from "react";

import { $getHeadingAnchors, goToHeading } from "../heading-anchors";

const MODIFIER = IS_APPLE ? "⌘" : "Ctrl";

/** The link anchor holding `target`, if it is inside the editor. */
function getLinkElement(editor: LexicalEditor, target: EventTarget | null) {
  const root = editor.getRootElement();
  const anchor = target instanceof Element ? target.closest("a") : null;

  return anchor && root?.contains(anchor) ? anchor : null;
}

/** The browser history state key holding where a section link left from or landed. */
const POSITION_STATE_KEY = "lunarscribeLinkPosition";

/**
 * A place in one editor: the scroll offset it was left at, or the heading a link went to.
 * `editor` ties it to the editor that pushed it, so another buffer ignores it.
 */
type LinkPosition =
  | { editor: string; scrollTop: number }
  | { editor: string; heading: NodeKey };

/** The scroll area around the editor. */
function getViewport(editor: LexicalEditor) {
  return (
    editor
      .getRootElement()
      ?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null
  );
}

/**
 * Jumps to the heading `slug` names, if the buffer has one. The jump is a browser history
 * entry, so Back (a mouse button or touchpad swipe) returns to where the reader was.
 */
function goToSection(editor: LexicalEditor, editorId: string, slug: string) {
  const key = editor.read(
    () => $getHeadingAnchors().find((heading) => heading.slug === slug)?.key,
  );

  if (key === undefined) {
    return;
  }

  const viewport = getViewport(editor);

  if (viewport) {
    const origin: LinkPosition = {
      editor: editorId,
      scrollTop: viewport.scrollTop,
    };

    const target: LinkPosition = { editor: editorId, heading: key };

    // Keep the router's own state; only this key changes.
    history.replaceState(
      { ...history.state, [POSITION_STATE_KEY]: origin },
      "",
    );
    history.pushState({ ...history.state, [POSITION_STATE_KEY]: target }, "");
  }

  goToHeading(editor, key);
}

/** Returns to a position a section link recorded, when it belongs to this editor. */
function restorePosition(
  editor: LexicalEditor,
  editorId: string,
  position: LinkPosition | undefined,
) {
  if (position?.editor !== editorId) {
    return;
  }

  if ("heading" in position) {
    goToHeading(editor, position.heading);
  } else {
    getViewport(editor)?.scrollTo({
      top: position.scrollTop,
      behavior: "smooth",
    });
  }
}

/**
 * Opens a link on Ctrl+click (⌘+click on macOS) and hints at it on hover. A
 * `#slug` link jumps to the heading with that slug instead, and Back returns.
 */
export function LinkOpenPlugin() {
  const [editor] = useLexicalComposerContext();
  const [hovered, setHovered] = useState<HTMLAnchorElement | null>(null);
  const [editorId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) =>
      setHovered(getLinkElement(editor, event.target));

    const onPointerLeave = () => setHovered(null);

    const onClick = (event: MouseEvent) => {
      const anchor = getLinkElement(editor, event.target);

      if (!anchor || !(IS_APPLE ? event.metaKey : event.ctrlKey)) {
        return;
      }

      const url = editor.read(() => {
        const node = $getNearestNodeFromDOMNode(anchor);
        const link = node && $findMatchingParent(node, $isLinkNode);

        return $isLinkNode(link) ? link.sanitizeUrl(link.getURL()) : null;
      });

      if (url?.startsWith("#")) {
        event.preventDefault();
        goToSection(editor, editorId, url.slice(1));
      } else if (url) {
        event.preventDefault();
        // The desktop app hands new windows to the system browser.
        window.open(url, "_blank", "noopener");
      }
    };

    const onPopState = (event: PopStateEvent) =>
      restorePosition(editor, editorId, event.state?.[POSITION_STATE_KEY]);

    window.addEventListener("popstate", onPopState);

    let controller = new AbortController();

    const unregister = editor.registerRootListener((root) => {
      controller.abort();
      controller = new AbortController();

      const { signal } = controller;

      root?.addEventListener("pointermove", onPointerMove, { signal });
      root?.addEventListener("pointerleave", onPointerLeave, { signal });
      root?.addEventListener("click", onClick, { signal });
    });

    return () => {
      window.removeEventListener("popstate", onPopState);
      unregister();
      controller.abort();
    };
  }, [editor, editorId]);

  return (
    <Tooltip open={hovered !== null}>
      <TooltipContent anchor={hovered}>
        <KbdGroup>
          <Kbd>{MODIFIER}</Kbd>
          <Kbd>Click</Kbd>
        </KbdGroup>
        <span>to open</span>
      </TooltipContent>
    </Tooltip>
  );
}
