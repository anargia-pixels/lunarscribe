import { DrawingEditor } from "@lunarscribe/components/editor/drawing-editor";
import { MarkdownEditor } from "@lunarscribe/components/editor/markdown-editor";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Alert, AlertDescription } from "@lunarscribe/components/ui/alert";
import { Button } from "@lunarscribe/components/ui/button";
import { Input } from "@lunarscribe/components/ui/input";
import { SidebarTrigger } from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { useEffect } from "react";

import { EditorFileDropZone } from "@/components/editor-file-drop-zone";
import { useAppearanceStore } from "@/stores/appearance-store";
import {
  toBufferTitle,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";

/** Editor page for the active buffer. */
export default function Page() {
  const buffer = useActiveBuffer();
  const renameBuffer = useBufferStore((state) => state.renameBuffer);
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

  return (
    <div className="flex h-svh flex-col">
      {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
      <TooltipProvider delay={800} timeout={300}>
        <header className="relative flex h-12 shrink-0 items-center justify-center border-b px-12">
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
          <Input
            aria-label="Buffer title"
            value={buffer.title}
            readOnly={buffer.externalPath !== null}
            title={buffer.externalPath ?? undefined}
            onChange={(event) => {
              const input = event.target;
              const caret = input.selectionStart;

              // Rewrite the field in place so React doesn't reset the caret to the end.
              input.value = toBufferTitle(input.value);
              input.setSelectionRange(caret, caret);
              renameBuffer(buffer.id, input.value);
            }}
            className="h-8 max-w-sm text-center"
          />
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
