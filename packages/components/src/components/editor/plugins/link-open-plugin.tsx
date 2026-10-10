import { $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import { Kbd, KbdGroup } from "@lunarscribe/components/ui/kbd";
import { Tooltip, TooltipContent } from "@lunarscribe/components/ui/tooltip";
import {
  $getNearestNodeFromDOMNode,
  IS_APPLE,
  type LexicalEditor,
} from "lexical";
import { useEffect, useState } from "react";

const MODIFIER = IS_APPLE ? "⌘" : "Ctrl";

/** The link anchor holding `target`, if it is inside the editor. */
function getLinkElement(editor: LexicalEditor, target: EventTarget | null) {
  const root = editor.getRootElement();
  const anchor = target instanceof Element ? target.closest("a") : null;

  return anchor && root?.contains(anchor) ? anchor : null;
}

/** Opens a link on Ctrl+click (⌘+click on macOS) and hints at it on hover. */
export function LinkOpenPlugin() {
  const [editor] = useLexicalComposerContext();
  const [hovered, setHovered] = useState<HTMLAnchorElement | null>(null);

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

      if (url) {
        event.preventDefault();
        // The desktop app hands new windows to the system browser.
        window.open(url, "_blank", "noopener");
      }
    };

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
      unregister();
      controller.abort();
    };
  }, [editor]);

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
