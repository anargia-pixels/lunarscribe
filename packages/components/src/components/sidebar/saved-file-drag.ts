import { folderOf } from "@lunarscribe/utils/saved-paths";
import { useCallback, useState } from "react";
import type { DragEvent } from "react";

/** Marks a drag as a saved file from the sidebar, apart from files dragged in from the OS. */
const SAVED_FILE_DRAG_TYPE = "application/x-lunarscribe-saved-file";

/** Clears the highlight of the target under the drag, so only the innermost one shows. */
let clearActiveTarget: (() => void) | null = null;

function setActiveTarget(clear: (() => void) | null) {
  if (clearActiveTarget !== clear) {
    clearActiveTarget?.();
    clearActiveTarget = clear;
  }
}

function isSavedFileDrag(event: DragEvent) {
  return event.dataTransfer.types.includes(SAVED_FILE_DRAG_TYPE);
}

/** Props that make a sidebar item drag the saved file at `path`. */
export function savedFileDragProps(path: string) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(SAVED_FILE_DRAG_TYPE, path);
      event.dataTransfer.effectAllowed = "move";
    },
    // A cancelled drag leaves no target highlighted.
    onDragEnd: () => setActiveTarget(null),
  };
}

/**
 * Makes an element take saved files dropped on it and move them into `folder` (`""` for
 * the top level). The innermost target wins, so a folder inside another takes the drop.
 * `isOver` is true while a file is dragged over it; files already there are ignored.
 */
export function useSavedFileDrop(
  folder: string,
  onMove: (path: string, folder: string) => void,
) {
  const [isOver, setIsOver] = useState(false);
  const clear = useCallback(() => setIsOver(false), []);

  const dropProps = {
    onDragOver: (event: DragEvent) => {
      if (!isSavedFileDrag(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setActiveTarget(clear);
      setIsOver(true);
    },
    onDragLeave: (event: DragEvent) => {
      const next = event.relatedTarget;

      if (!(next instanceof Node && event.currentTarget.contains(next))) {
        setIsOver(false);

        if (clearActiveTarget === clear) {
          clearActiveTarget = null;
        }
      }
    },
    onDrop: (event: DragEvent) => {
      if (!isSavedFileDrag(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setActiveTarget(null);

      const path = event.dataTransfer.getData(SAVED_FILE_DRAG_TYPE);

      if (path && folderOf(path) !== folder) {
        onMove(path, folder);
      }
    },
  };

  return { isOver, dropProps };
}
