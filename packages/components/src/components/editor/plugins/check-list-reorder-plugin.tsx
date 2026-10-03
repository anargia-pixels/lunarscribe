import { $isListItemNode, $isListNode, ListItemNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $addUpdateTag,
  $getNodeByKey,
  $hasUpdateTag,
  HISTORIC_TAG,
  HISTORY_PUSH_TAG,
  mergeRegister,
  type NodeKey,
} from "lexical";
import { useEffect } from "react";

/** Moves completed items within their own list, in the same undo step as the toggle. */
export function CheckListReorderPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const positions = new Map<HTMLElement, DOMRect>();
    const animations = new Map<HTMLElement, Animation>();
    const handled = new Set<NodeKey>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let focusedItem: HTMLElement | null = null;

    const cancelAnimations = () => {
      for (const animation of animations.values()) {
        animation.cancel();
      }

      animations.clear();
    };

    const onMotionChange = () => {
      if (reducedMotion.matches) {
        cancelAnimations();
      }
    };

    reducedMotion.addEventListener("change", onMotionChange);

    return mergeRegister(
      editor.registerNodeTransform(ListItemNode, (item) => {
        const key = item.getKey();
        const list = item.getParent();
        const checked = item.getChecked();

        if (
          $hasUpdateTag(HISTORIC_TAG) ||
          handled.has(key) ||
          !editor.isEditable() ||
          !$isListNode(list) ||
          list.getListType() !== "check" ||
          $isListNode(item.getFirstChild())
        ) {
          return;
        }

        const previousChecked = editor.getEditorState().read(() => {
          const previous = $getNodeByKey(key);

          return $isListItemNode(previous) &&
            previous.getParent()?.getKey() === list.getKey()
            ? previous.getChecked()
            : undefined;
        });

        // Loading, pasting, and typing in an item must not reorder the list.
        if (previousChecked === undefined || previousChecked === checked) {
          return;
        }

        handled.add(key);
        $addUpdateTag(HISTORY_PUSH_TAG);

        // Lexical stores a task's indented list in separate following wrappers.
        const group = [item];

        for (const sibling of item.getNextSiblings()) {
          if (
            !$isListItemNode(sibling) ||
            !$isListNode(sibling.getFirstChild())
          ) {
            break;
          }

          group.push(sibling);
        }

        const destination = checked
          ? null
          : list
              .getChildren()
              .find(
                (sibling) =>
                  $isListItemNode(sibling) &&
                  !$isListNode(sibling.getFirstChild()) &&
                  sibling.getChecked(),
              );

        if (
          checked
            ? group.at(-1)?.is(list.getLastChild())
            : !destination ||
              destination.getIndexWithinParent() > item.getIndexWithinParent()
        ) {
          return;
        }

        const itemElement = editor.getElementByKey(key);

        if (itemElement?.ownerDocument.activeElement === itemElement) {
          focusedItem = itemElement;
        }

        if (!reducedMotion.matches) {
          for (const child of list.getChildren()) {
            const element = editor.getElementByKey(child.getKey());

            if (element && !positions.has(element)) {
              positions.set(element, element.getBoundingClientRect());
            }
          }
        }

        if (destination) {
          for (const member of group) {
            destination.insertBefore(member);
          }
        } else {
          list.append(...group);
        }
      }),
      editor.registerUpdateListener(({ tags }) => {
        handled.clear();

        if (focusedItem?.isConnected) {
          focusedItem.focus({ preventScroll: true });
        }

        focusedItem = null;

        if (tags.has(HISTORIC_TAG)) {
          cancelAnimations();
          positions.clear();

          return;
        }

        if (positions.size === 0) {
          return;
        }

        // Capture visual positions before cancelling so rapid toggles retarget
        // from the current animation frame. Reconciliation has now moved the DOM.
        for (const element of positions.keys()) {
          animations.get(element)?.cancel();
          animations.delete(element);
        }

        if (!reducedMotion.matches) {
          const movements = [];

          for (const [element, before] of positions) {
            if (!element.isConnected) {
              continue;
            }

            const after = element.getBoundingClientRect();
            const x = before.left - after.left;
            const y = before.top - after.top;

            if (x !== 0 || y !== 0) {
              movements.push({ element, x, y });
            }
          }

          // Batch all measurements before starting compositor-only movement.
          for (const { element, x, y } of movements) {
            const animation = element.animate(
              [
                { transform: `translate(${x}px, ${y}px)` },
                { transform: "translate(0, 0)" },
              ],
              { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
            );

            animations.set(element, animation);
            animation.onfinish = () => animations.delete(element);
          }
        }

        positions.clear();
      }),
      () => {
        reducedMotion.removeEventListener("change", onMotionChange);
        cancelAnimations();
        positions.clear();
      },
    );
  }, [editor]);

  return null;
}
