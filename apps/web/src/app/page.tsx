import type {
  DrawingEditor,
  DrawingEditorProps,
} from "@lunarscribe/components/editor/drawing-editor";
import { MarkdownEditor } from "@lunarscribe/components/editor/markdown-editor";
import { Hint } from "@lunarscribe/components/hint/hint";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@lunarscribe/components/ui/alert";
import { Button } from "@lunarscribe/components/ui/button";
import { SidebarTrigger } from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { useEffect, useState } from "react";

import { EditorFileDropZone } from "@/components/editor-file-drop-zone";
import { BUFFER_EXTENSIONS, isTextFile } from "@/lib/editor-files";
import { MOD_KEY_LABEL } from "@/lib/platform";
import { useAppearanceStore } from "@/stores/appearance-store";
import { useActiveBuffer, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

/** Loads the drawing canvas only when a drawing buffer opens. */
function LazyDrawingEditor(props: DrawingEditorProps) {
  const [Canvas, setCanvas] = useState<typeof DrawingEditor | null>(null);
  const [hasLoadFailed, setHasLoadFailed] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    void import("@lunarscribe/components/editor/drawing-editor").then(
      ({ DrawingEditor: canvas }) => {
        if (!isCancelled) {
          setCanvas(() => canvas);
        }
      },
      (error) => {
        if (!isCancelled) {
          console.error("Unable to load drawing editor.", error);
          setHasLoadFailed(true);
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, []);

  if (hasLoadFailed) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load drawing editor</AlertTitle>
        <AlertDescription>
          Save your open buffers, then reload Lunarscribe to try again.
        </AlertDescription>
      </Alert>
    );
  }

  return Canvas === null ? null : <Canvas {...props} />;
}

/** Editor page for the active buffer. */
export default function Page() {
  const buffer = useActiveBuffer();
  const setContent = useBufferStore((state) => state.setContent);
  const theme = useAppearanceStore((state) => state.theme);
  const clearFileError = useBufferStore((state) => state.clearFileError);
  const fileError = useBufferStore((state) => state.fileError);
  const externalFiles = useBufferStore((state) => state.externalFiles);

  const hasSyncedSuccessfully = useSyncStore(
    (state) => state.hasSyncedSuccessfully,
  );

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
      }
    };

    // An installed app receives files opened from the OS through the launch queue.
    window.launchQueue?.setConsumer(({ files }) => {
      const handles = files.filter(
        (handle): handle is FileSystemFileHandle =>
          handle instanceof FileSystemFileHandle && isTextFile(handle.name),
      );

      if (handles.length) {
        void useBufferStore.getState().openExternalHandles(handles, []);
      }
    });

    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);

    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  if (!buffer) {
    return null;
  }

  const fileName =
    buffer.fileName ?? `${buffer.title}${BUFFER_EXTENSIONS[buffer.kind]}`;

  // Browsers expose no paths, so external files show only their name.
  const filePath = buffer.externalId
    ? (externalFiles.find((file) => file.id === buffer.externalId)?.name ??
      fileName)
    : `lunarscribe / ${fileName}`;

  return (
    <div className="flex h-svh flex-col">
      {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
      <TooltipProvider delay={800} timeout={300}>
        <header className="relative flex h-10 shrink-0 items-center justify-center border-b px-12 text-xs">
          <Hint
            label="Toggle sidebar"
            side="bottom"
            shortcut={[MOD_KEY_LABEL, "⇧", "B"]}
          >
            <SidebarTrigger className="absolute left-3" />
          </Hint>
          <span
            aria-label="File path"
            title={filePath}
            className="max-w-3xl min-w-0 truncate text-center select-none"
          >
            {filePath}
          </span>
          <output className="text-muted-foreground ml-1 shrink-0 select-none">
            {hasSyncedSuccessfully && buffer.fileName && !buffer.externalId
              ? "- Sync successful"
              : null}
          </output>
        </header>
      </TooltipProvider>
      {fileError && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-wrap">
            {fileError}
            <Button variant="ghost" size="sm" onClick={clearFileError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {buffer.kind === "drawing" ? (
        <LazyDrawingEditor
          key={`${buffer.id}:${buffer.syncRevision}`}
          scene={buffer.content}
          theme={theme}
          onChange={(scene) => setContent(buffer.id, scene)}
        />
      ) : (
        <EditorFileDropZone>
          <MarkdownEditor
            key={`${buffer.id}:${buffer.syncRevision}`}
            markdown={buffer.content}
            onChange={(markdown) => setContent(buffer.id, markdown)}
          />
        </EditorFileDropZone>
      )}
    </div>
  );
}
