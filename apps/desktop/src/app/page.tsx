import { DrawingEditor } from "@lunarscribe/components/editor/drawing-editor";
import { MarkdownEditor } from "@lunarscribe/components/editor/markdown-editor";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Alert, AlertDescription } from "@lunarscribe/components/ui/alert";
import { Button } from "@lunarscribe/components/ui/button";
import { SidebarTrigger } from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { useEffect } from "react";

import { EditorFileDropZone } from "@/components/editor-file-drop-zone";
import { BUFFER_EXTENSIONS } from "@/lib/editor-files";
import { useAppearanceStore } from "@/stores/appearance-store";
import { useActiveBuffer, useBufferStore } from "@/stores/buffer-store";

/** Editor page for the active buffer. */
export default function Page() {
  const buffer = useActiveBuffer();
  const setContent = useBufferStore((state) => state.setContent);
  const theme = useAppearanceStore((state) => state.theme);
  const clearFileError = useBufferStore((state) => state.clearFileError);
  const fileError = useBufferStore((state) => state.fileError);

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
      }
    };

    const unsubscribe = window.lunarscribe.onExternalFilesOpened((paths) => {
      void useBufferStore.getState().openExternalFiles(paths);
    });

    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);

    return () => {
      unsubscribe();
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  if (!buffer) {
    return null;
  }

  const fileName =
    buffer.fileName ?? `${buffer.title}${BUFFER_EXTENSIONS[buffer.kind]}`;

  const filePath = buffer.externalPath ?? `lunarscribe / ${fileName}`;

  return (
    <div className="flex h-svh flex-col">
      {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
      <TooltipProvider delay={800} timeout={300}>
        <header className="relative flex h-10 shrink-0 items-center justify-center border-b px-12 text-xs">
          <Hint
            label="Toggle sidebar"
            side="bottom"
            shortcut={[
              window.lunarscribe.platform === "darwin" ? "⌘" : "Ctrl",
              "⇧",
              "B",
            ]}
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
        <DrawingEditor
          key={buffer.id}
          scene={buffer.content}
          theme={theme}
          onChange={(scene) => setContent(buffer.id, scene)}
        />
      ) : (
        <EditorFileDropZone>
          <MarkdownEditor
            key={buffer.id}
            markdown={buffer.content}
            onChange={(markdown) => setContent(buffer.id, markdown)}
          />
        </EditorFileDropZone>
      )}
    </div>
  );
}
