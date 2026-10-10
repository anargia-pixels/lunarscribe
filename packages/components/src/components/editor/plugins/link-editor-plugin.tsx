import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { createDOMRange } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { cn } from "@lunarscribe/utils/cn";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalEditor,
  type NodeKey,
} from "lexical";
import { Pencil, Unlink } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  $applyLink,
  $getLinkDraft,
  $getSelectedLink,
  $removeLink,
  type LinkDraft,
  LinkForm,
} from "../link-form";

type SelectedLink = { key: NodeKey; url: string };

/** `key` is the edited link, or null for a new link at the selection. */
type EditDraft = LinkDraft & { key: NodeKey | null };

/** Opens the link form: edits the link around the selection, or adds one. */
export const OPEN_LINK_FORM_COMMAND = createCommand<void>(
  "OPEN_LINK_FORM_COMMAND",
);

/** Where a new link goes: the selection's last line, or its block when empty. */
function getSelectionRect(editor: LexicalEditor) {
  return editor.read(() => {
    const selection = $getSelection();

    if (!$isRangeSelection(selection)) {
      return null;
    }

    const { anchor, focus } = selection;

    const range = createDOMRange(
      editor,
      anchor.getNode(),
      anchor.offset,
      focus.getNode(),
      focus.offset,
    );

    const rect = range && [...range.getClientRects()].at(-1);

    return rect && rect.height > 0
      ? rect
      : editor.getElementByKey(anchor.key)?.getBoundingClientRect();
  });
}

/**
 * A bar under the link holding the caret: shows its URL, and edits or removes
 * the link in place.
 */
export function LinkEditorPlugin() {
  const [editor] = useLexicalComposerContext();
  const [link, setLink] = useState<SelectedLink | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const linkKey = link?.key ?? null;
  const isAdding = draft?.key === null;
  const isEditing = isAdding || (draft !== null && draft.key === linkKey);

  useEffect(() => {
    // Read node values here: React runs the state updater later, outside the
    // editor read where Lexical nodes are accessible.
    const readLink = () => {
      const node = $getSelectedLink();
      const next = node && { key: node.getKey(), url: node.getURL() };

      setLink((current) =>
        current?.key === next?.key && current?.url === next?.url
          ? current
          : next,
      );
    };

    editor.read(readLink);

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(readLink),
      ),
      editor.registerCommand(
        OPEN_LINK_FORM_COMMAND,
        () => {
          setDraft({
            ...$getLinkDraft(),
            key: $getSelectedLink()?.getKey() ?? null,
          });

          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor]);

  // A new link has no link to follow, so a click outside closes its form.
  useEffect(() => {
    if (!isAdding) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target instanceof Node) ||
        !barRef.current?.contains(event.target)
      ) {
        setDraft(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isAdding]);

  useLayoutEffect(() => {
    const element = linkKey === null ? null : editor.getElementByKey(linkKey);
    const bar = barRef.current;
    const container = bar?.offsetParent;

    if ((!element && !isAdding) || !bar || !container) {
      return;
    }

    const positionBar = () => {
      // A wrapped link places the bar under its last line.
      const anchorRect = isAdding
        ? getSelectionRect(editor)
        : [...(element?.getClientRects() ?? [])].at(-1);

      const containerRect = container.getBoundingClientRect();

      if (!anchorRect) {
        return;
      }

      // Geometry follows the link; appearance stays in Tailwind.
      bar.style.left = `${anchorRect.left - containerRect.left}px`;
      bar.style.top = `${anchorRect.bottom - containerRect.top + 4}px`;
    };

    positionBar();

    const observer = new ResizeObserver(positionBar);

    observer.observe(container);
    window.addEventListener("resize", positionBar);

    return mergeRegister(editor.registerUpdateListener(positionBar), () => {
      observer.disconnect();
      window.removeEventListener("resize", positionBar);
    });
  }, [editor, linkKey, isEditing, isAdding]);

  if (!link && !isAdding) {
    return null;
  }

  const finish = (apply?: () => void) => {
    setDraft(null);

    if (apply) {
      editor.update(apply);
    }

    editor.focus();
  };

  return (
    <div
      ref={barRef}
      className={cn(
        "bg-popover text-popover-foreground ring-foreground/10 absolute z-20 flex max-w-80 items-center gap-0.5 rounded-lg p-1 text-sm shadow-md ring-1",
        isEditing && "w-72 p-2.5",
      )}
    >
      {draft && isEditing ? (
        <div className="w-full">
          <LinkForm
            draft={draft}
            onSubmit={(text, url) => finish(() => $applyLink(text, url))}
            onRemove={() => finish($removeLink)}
            onCancel={() => finish()}
          />
        </div>
      ) : (
        link && (
          <>
            <span className="text-muted-foreground min-w-0 truncate px-1.5">
              {link.url}
            </span>
            <Hint label="Edit link">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit link"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  setDraft({ ...editor.read($getLinkDraft), key: link.key })
                }
              >
                <Pencil />
              </Button>
            </Hint>
            <Hint label="Remove link">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Remove link"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.update($removeLink)}
              >
                <Unlink />
              </Button>
            </Hint>
          </>
        )
      )}
    </div>
  );
}
