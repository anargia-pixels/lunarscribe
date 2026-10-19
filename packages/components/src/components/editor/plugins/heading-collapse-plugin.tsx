import "./heading-collapse-plugin.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isHeadingNode } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import { Button } from "@lunarscribe/components/ui/button";
import { cn } from "@lunarscribe/utils/cn";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type LexicalNode,
  type NodeKey,
} from "lexical";
import { ChevronDown } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";

type Toggle = { key: NodeKey; offset: number; collapsed: boolean };

type ToggleStyle = CSSProperties & {
  "--toggle-anchor": string;
  "--toggle-offset": string;
};

/** The CSS anchor a heading's toggle is positioned against. */
function anchorName(key: NodeKey) {
  return `--heading-${key}`;
}

function $getLevel(node: LexicalNode) {
  return $isHeadingNode(node) ? Number(node.getTag().slice(1)) : null;
}

/** Maps each block hidden by a collapsed heading to that heading. */
function $getHiddenBlocks(collapsed: Set<NodeKey>) {
  const hidden = new Map<NodeKey, NodeKey>();
  let section: { key: NodeKey; level: number } | null = null;

  for (const child of $getRoot().getChildren()) {
    const level = $getLevel(child);

    if (section && level !== null && level <= section.level) {
      section = null;
    }

    if (section) {
      hidden.set(child.getKey(), section.key);
    } else if (level !== null && collapsed.has(child.getKey())) {
      section = { key: child.getKey(), level };
    }
  }

  return hidden;
}

function $getSelectedBlockKey() {
  const selection = $getSelection();

  return $isRangeSelection(selection)
    ? selection.anchor.getNode().getTopLevelElement()?.getKey()
    : undefined;
}

/**
 * Collapses the blocks under a heading up to the next heading of the same or a
 * higher level. Collapsing only hides DOM, so the markdown never changes.
 */
export function HeadingCollapsePlugin() {
  const [editor] = useLexicalComposerContext();
  const [toggles, setToggles] = useState<Toggle[]>([]);
  const collapsedRef = useRef(new Set<NodeKey>());
  const syncRef = useRef<(expandSelection: boolean) => void>(() => {});

  useEffect(() => {
    const collapsed = collapsedRef.current;
    // Toggles render only for headings near the scroll viewport: hundreds of
    // positioned toggles make every reflow slow, and an anchor whose heading
    // is skipped by `content-visibility` cannot place its toggle.
    const watched = new Set<Element>();
    const nearViewport = new Set<Element>();
    let intersectionObserver: IntersectionObserver | null = null;

    // Hides collapsed sections and places a toggle beside every shown heading
    // near the viewport. A caret moved into a hidden section expands it.
    const sync = (expandSelection: boolean) =>
      editor.read(() => {
        for (const key of collapsed) {
          const node = $getNodeByKey(key);

          if (!$isHeadingNode(node) || !node.isAttached()) {
            collapsed.delete(key);
          }
        }

        let hidden = $getHiddenBlocks(collapsed);
        const selectedKey = $getSelectedBlockKey();
        const owner = selectedKey ? hidden.get(selectedKey) : undefined;

        if (expandSelection && owner !== undefined) {
          collapsed.delete(owner);
          hidden = $getHiddenBlocks(collapsed);
        }

        const nextToggles: Toggle[] = [];
        const headings = new Set<Element>();

        for (const child of $getRoot().getChildren()) {
          const key = child.getKey();
          const element = editor.getElementByKey(key);

          if (!element) {
            continue;
          }

          // Only write changed blocks; rewriting all of them on every update
          // and resize frame invalidates style across a long buffer.
          if (element.hidden !== hidden.has(key)) {
            element.hidden = hidden.has(key);
          }

          if (hidden.has(key) || !$isHeadingNode(child)) {
            continue;
          }

          headings.add(element);

          if (!watched.has(element)) {
            watched.add(element);
            intersectionObserver?.observe(element);
          }

          if (!nearViewport.has(element)) {
            continue;
          }

          // The toggle follows its heading through CSS anchor positioning, so
          // reflowing the buffer moves it without any measuring here.
          if (
            element.style.getPropertyValue("anchor-name") !== anchorName(key)
          ) {
            element.style.setProperty("anchor-name", anchorName(key));
          }

          // Center the h-6 toggle on the heading's first line.
          const lineHeight = Number.parseFloat(
            getComputedStyle(element).lineHeight,
          );

          nextToggles.push({
            key,
            offset: (lineHeight - 24) / 2,
            collapsed: collapsed.has(key),
          });
        }

        for (const element of watched) {
          if (!headings.has(element)) {
            intersectionObserver?.unobserve(element);
            watched.delete(element);
            nearViewport.delete(element);
          }
        }

        setToggles((previous) =>
          previous.length === nextToggles.length &&
          previous.every((toggle, index) => {
            const next = nextToggles[index];

            return (
              toggle.key === next?.key &&
              toggle.offset === next.offset &&
              toggle.collapsed === next.collapsed
            );
          })
            ? previous
            : nextToggles,
        );
      });

    syncRef.current = sync;

    // Anchors keep toggles beside their headings while the editor resizes; a
    // font change can alter the line heights, so measure once it settles.
    let resizeTimeoutId: number | undefined;

    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimeoutId);
      resizeTimeoutId = window.setTimeout(() => sync(false), 150);
    });

    const disconnectHeadings = () => {
      intersectionObserver?.disconnect();
      intersectionObserver = null;
      watched.clear();
      nearViewport.clear();
    };

    return mergeRegister(
      editor.registerRootListener((root, previousRoot) => {
        if (previousRoot) {
          observer.unobserve(previousRoot);
        }

        disconnectHeadings();

        if (root) {
          observer.observe(root);
          // Stay inside the 50% viewport margin `content-visibility` renders.
          intersectionObserver = new IntersectionObserver(
            (entries) => {
              for (const { target, isIntersecting } of entries) {
                if (isIntersecting) {
                  nearViewport.add(target);
                } else {
                  nearViewport.delete(target);
                }
              }

              sync(false);
            },
            {
              root: root.closest('[data-slot="scroll-area-viewport"]'),
              rootMargin: "25% 0px",
            },
          );
          sync(false);
        }
      }),
      editor.registerUpdateListener(() => sync(true)),
      () => {
        window.clearTimeout(resizeTimeoutId);
        observer.disconnect();
        disconnectHeadings();
      },
    );
  }, [editor]);

  const toggle = (key: NodeKey) => {
    const collapsed = collapsedRef.current;

    if (!collapsed.delete(key)) {
      collapsed.add(key);
    }

    const hidesCaret = editor.read(() => {
      const selectedKey = $getSelectedBlockKey();

      return (
        selectedKey !== undefined &&
        $getHiddenBlocks(collapsed).get(selectedKey) === key
      );
    });

    if (!hidesCaret) {
      syncRef.current(false);

      return;
    }

    // Move the caret out of the section it just hid, so it does not reopen
    // it. The update listener then applies the new collapsed state.
    editor.update(() => {
      const heading = $getNodeByKey(key);

      if ($isHeadingNode(heading)) {
        heading.selectEnd();
      }
    });
  };

  return toggles.map(({ key, offset, collapsed }) => {
    // Geometry comes from the heading; appearance stays in Tailwind.
    const style: ToggleStyle = {
      "--toggle-anchor": anchorName(key),
      "--toggle-offset": `${offset}px`,
    };

    return (
      <Button
        key={key}
        variant="ghost"
        size="xs"
        aria-label={collapsed ? "Expand section" : "Collapse section"}
        data-heading-toggle
        className="absolute z-10 -ml-1.5 -translate-x-full"
        style={style}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggle(key)}
      >
        <ChevronDown
          className={cn(
            "transition-transform duration-200",
            collapsed && "-rotate-90",
          )}
        />
      </Button>
    );
  });
}
