import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { DRAG_DROP_PASTE } from "@lexical/rich-text";
import { $insertNodeToNearestRoot } from "@lexical/utils";
import { errorMessage } from "@lunarscribe/utils/error-message";
import {
  pastedImageFileName,
  toImageFileName,
} from "@lunarscribe/utils/images";
import {
  $addUpdateTag,
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  DROP_COMMAND,
  HISTORY_PUSH_TAG,
  type LexicalEditor,
  mergeRegister,
  type PointType,
} from "lexical";
import { useContext, useEffect } from "react";

import { EditorImagesContext } from "./image-context";
import { $createImageNode, ImageNode } from "./image-node";

/** A file the editor can embed, renamed the way Obsidian names pasted images. */
function toEmbeddableFile(file: File, isPaste: boolean) {
  const name = toImageFileName(file.name, file.type);

  if (!name) {
    return null;
  }

  // Clipboard images arrive as `image.png`; give each paste its own name.
  const isClipboardImage = isPaste && /^image\.[a-z]+$/u.test(file.name);

  return new File(
    [file],
    isClipboardImage ? pastedImageFileName(file.type) : name,
    { type: file.type },
  );
}

/** Inserts image blocks for `targets` at `point`, splitting the paragraph there. */
function insertImages(
  editor: LexicalEditor,
  point: { key: string; offset: number; type: PointType["type"] } | null,
  targets: string[],
) {
  editor.update(() => {
    const anchor = point && $getNodeByKey(point.key);

    if (point && anchor) {
      const selection = $createRangeSelection();

      selection.anchor.set(point.key, point.offset, point.type);
      selection.focus.set(point.key, point.offset, point.type);
      $setSelection(selection);
    } else if (!$isRangeSelection($getSelection())) {
      $getRoot().selectEnd();
    }

    for (const target of targets) {
      $insertNodeToNearestRoot(
        $createImageNode({
          target,
          alt: "",
          width: null,
          height: null,
          syntax: "wikilink",
          title: null,
        }),
      );
    }

    $addUpdateTag(HISTORY_PUSH_TAG);
  });
}

/**
 * Embeds images dropped or pasted into the editor, as in Obsidian: the app copies each
 * file next to the buffer's markdown file, and an `![[name.png]]` block goes in at the
 * drop point or caret. Other files fall through to the editor's own handling.
 */
export function ImagePlugin() {
  const [editor] = useLexicalComposerContext();
  const images = useContext(EditorImagesContext);
  const saveImages = images?.saveImages;
  const onSaveError = images?.onSaveError;

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error("ImagePlugin requires ImageNode to be registered.");
    }

    if (!saveImages) {
      return;
    }

    // Lexical sends drops and pastes through DRAG_DROP_PASTE; a drop comes just before.
    let isDrop = false;

    return mergeRegister(
      editor.registerCommand(
        DROP_COMMAND,
        () => {
          isDrop = true;
          queueMicrotask(() => {
            isDrop = false;
          });

          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        DRAG_DROP_PASTE,
        (files) => {
          const isPaste = !isDrop;

          isDrop = false;

          if (!editor.isEditable()) {
            return false;
          }

          const embeddable = files
            .map((file) => toEmbeddableFile(file, isPaste))
            .filter((file) => file !== null);

          if (embeddable.length === 0) {
            return false;
          }

          // Keep the drop point; saving is async and the caret may move meanwhile.
          const selection = $getSelection();

          const point = $isRangeSelection(selection)
            ? {
                key: selection.anchor.key,
                offset: selection.anchor.offset,
                type: selection.anchor.type,
              }
            : null;

          saveImages(embeddable).then(
            (targets) => insertImages(editor, point, targets),
            (cause: unknown) =>
              onSaveError?.(
                errorMessage(cause, "The image could not be saved."),
              ),
          );

          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, saveImages, onSaveError]);

  return null;
}
