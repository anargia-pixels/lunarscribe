import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";

import { isTextFile } from "@/lib/editor-files";
import { useBufferStore } from "@/stores/buffer-store";

/** Writable handles where the browser offers them; other text files become imports. */
async function readDroppedFiles(
  pending: Promise<FileSystemHandle | null>[],
  files: File[],
) {
  const handles: FileSystemFileHandle[] = [];

  for (const handle of await Promise.all(pending)) {
    if (handle instanceof FileSystemFileHandle && isTextFile(handle.name)) {
      handles.push(handle);
    }
  }

  return { handles, files: handles.length ? [] : files };
}

/** Opens dropped text files while keeping file drops out of Lexical. */
export function EditorFileDropZone({ children }: { children: ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const openExternalHandles = useBufferStore(
    (state) => state.openExternalHandles,
  );

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

    event.preventDefault();
    event.stopPropagation();

    return true;
  };

  return (
    <section
      aria-label="Text file drop area"
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

        // Drop data is cleared after this handler returns, so request handles now.
        const pending: Promise<FileSystemHandle | null>[] = [];

        for (const item of event.dataTransfer.items) {
          if (item.kind === "file" && item.getAsFileSystemHandle) {
            pending.push(item.getAsFileSystemHandle());
          }
        }

        const files = Array.from(event.dataTransfer.files).filter((file) =>
          isTextFile(file.name),
        );

        void readDroppedFiles(pending, files).then(({ handles, files }) => {
          if (handles.length || files.length) {
            void openExternalHandles(handles, files);
          }
        });
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
