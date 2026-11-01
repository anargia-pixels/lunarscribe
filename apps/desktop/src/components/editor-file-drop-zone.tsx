import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";

import { isTextFile } from "@/lib/editor-files";
import { useBufferStore } from "@/stores/buffer-store";

/**
 * Opens dropped text files in the markdown editor, whichever editor is shown, keeping file
 * drops out of Lexical. Over a drawing (`isDrawing`), only drops holding a text file are
 * taken, so Excalidraw still receives the images and libraries it opens itself.
 */
export function EditorFileDropZone({
  isDrawing = false,
  children,
}: {
  isDrawing?: boolean;
  children: ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const openExternalFiles = useBufferStore((state) => state.openExternalFiles);

  useEffect(() => {
    const resetDrag = () => {
      dragDepth.current = 0;
      setIsDragging(false);
    };

    window.addEventListener("drop", resetDrag);
    window.addEventListener("dragend", resetDrag);
    window.addEventListener("blur", resetDrag);

    return () => {
      window.removeEventListener("drop", resetDrag);
      window.removeEventListener("dragend", resetDrag);
      window.removeEventListener("blur", resetDrag);
    };
  }, []);

  const captureFileDrag = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return false;
    }

    // Chromium hides OS file names until the drop, so a drawing lets drags pass until then.
    const hasTextFile = Array.from(event.dataTransfer.files).some((file) =>
      isTextFile(file.name),
    );

    if (isDrawing && !(event.type === "drop" && hasTextFile)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    return true;
  };

  return (
    <section
      aria-label={
        isDrawing ? "Drawing and text file drop area" : "Text file drop area"
      }
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnterCapture={(event) => {
        if (captureFileDrag(event)) {
          dragDepth.current += 1;
          // Chromium hides OS file names until drop, so extension validation happens there.
          setIsDragging(true);
        }
      }}
      onDragOverCapture={(event) => {
        if (captureFileDrag(event)) {
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeaveCapture={(event) => {
        if (captureFileDrag(event)) {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          setIsDragging(dragDepth.current > 0);
        }
      }}
      onDropCapture={(event) => {
        if (!captureFileDrag(event)) {
          return;
        }

        dragDepth.current = 0;
        setIsDragging(false);

        const paths: string[] = [];

        for (const file of event.dataTransfer.files) {
          if (isTextFile(file.name)) {
            paths.push(window.lunarscribe.getPathForFile(file));
          }
        }

        if (paths.length) {
          void openExternalFiles(paths);
        }
      }}
    >
      {children}
      {isDragging && (
        <div
          aria-hidden="true"
          className="border-primary pointer-events-none absolute inset-0 z-50 border-2 border-dashed"
        />
      )}
    </section>
  );
}
