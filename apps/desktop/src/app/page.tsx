import { SidebarRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  DrawingEditor,
  DrawingEditorProps,
} from "@lunarscribe/components/editor/drawing-editor";
import { ImageViewer } from "@lunarscribe/components/editor/image-viewer";
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
import { BUFFER_EXTENSIONS } from "@lunarscribe/utils/file-kinds";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { EditorFileDropZone } from "@/components/editor-file-drop-zone";
import {
  useEditorImages,
  useSavedImageSource,
} from "@/components/use-editor-images";
import { useAppearanceStore } from "@/stores/appearance-store";
import { bufferFileKey, useBufferStore } from "@/stores/buffer-store";
import { useFileAccessStore } from "@/stores/file-access-store";
import { useSidebarStore } from "@/stores/sidebar-store";
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
          Save your open buffers, then restart Lunarscribe to try again.
        </AlertDescription>
      </Alert>
    );
  }

  return Canvas === null ? null : <Canvas {...props} />;
}

/** Sync state shown after a saved file's path. */
function syncMessage(isSyncing: boolean, hasSyncedSuccessfully: boolean) {
  if (isSyncing) {
    return "- Sync in progress";
  }

  return hasSyncedSuccessfully ? "- Sync successful" : null;
}

/** Editor page for the active buffer. */
export default function Page() {
  // Typing only changes the content, which the mounted editor already owns, so
  // the page leaves it out and re-renders only when the buffer itself changes.
  const buffer = useBufferStore(
    useShallow((state) => {
      const active = state.buffers.find(({ id }) => id === state.activeId);

      return active
        ? {
            id: active.id,
            title: active.title,
            kind: active.kind,
            syncRevision: active.syncRevision,
            fileName: active.fileName,
            folder: active.folder,
            externalPath: active.externalPath,
          }
        : null;
    }),
  );

  const setContent = useBufferStore((state) => state.setContent);
  const setScrollTop = useFileAccessStore((state) => state.setScrollTop);
  const theme = useAppearanceStore((state) => state.theme);
  const setOutline = useSidebarStore((state) => state.setOutline);
  const toggleOutline = useSidebarStore((state) => state.toggleOutline);

  const showEditorToolbar = useAppearanceStore(
    (state) => state.showEditorToolbar,
  );

  const clearFileError = useBufferStore((state) => state.clearFileError);
  const fileError = useBufferStore((state) => state.fileError);

  const hasSyncedSuccessfully = useSyncStore(
    (state) => state.hasSyncedSuccessfully,
  );

  const isSyncing = useSyncStore((state) => state.isBusy);

  const viewedImage = useBufferStore((state) => state.viewedImage);
  const viewedImageSource = useSavedImageSource(viewedImage);

  const images = useEditorImages(
    buffer?.fileName ?? null,
    buffer?.folder ?? "",
    buffer?.externalPath ?? null,
  );

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

  // Unsaved buffers have no file to remember a scroll position for.
  const scrollKey = bufferFileKey(buffer);

  const fileName =
    buffer.fileName ?? `${buffer.title}${BUFFER_EXTENSIONS[buffer.kind]}`;

  const filePath =
    viewedImage !== null
      ? `lunarscribe / ${viewedImage}`
      : (buffer.externalPath ?? `lunarscribe / ${fileName}`);

  // Editors read the content once on mount; the key remounts them for a new one.
  const content =
    useBufferStore.getState().buffers.find(({ id }) => id === buffer.id)
      ?.content ?? "";

  return (
    <div className="flex h-svh flex-col">
      {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
      <TooltipProvider delay={800} timeout={300}>
        <header className="relative flex h-10 shrink-0 items-center justify-center border-b px-12 text-xs select-none">
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
            className="max-w-3xl min-w-0 truncate text-center"
          >
            {filePath}
          </span>
          <output className="text-muted-foreground ml-1 shrink-0">
            {viewedImage === null && buffer.fileName && !buffer.externalPath
              ? syncMessage(isSyncing, hasSyncedSuccessfully)
              : null}
          </output>
          {viewedImage === null && buffer.kind === "markdown" && (
            <Hint
              label="Toggle outline"
              side="bottom"
              shortcut={[
                window.lunarscribe.platform === "darwin" ? "⌘" : "Ctrl",
                window.lunarscribe.platform === "darwin" ? "⌥" : "Alt",
                "B",
              ]}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Toggle outline"
                className="absolute right-3 hidden md:inline-flex"
                onClick={toggleOutline}
              >
                <HugeiconsIcon icon={SidebarRightIcon} strokeWidth={2} />
              </Button>
            </Hint>
          )}
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
      {viewedImage !== null ? (
        <ImageViewer name={viewedImage} source={viewedImageSource} />
      ) : buffer.kind === "drawing" ? (
        <EditorFileDropZone isDrawing>
          <LazyDrawingEditor
            key={`${buffer.id}:${buffer.syncRevision}`}
            scene={content}
            theme={theme}
            onChange={(scene) => setContent(buffer.id, scene)}
          />
        </EditorFileDropZone>
      ) : (
        <EditorFileDropZone>
          <MarkdownEditor
            key={`${buffer.id}:${buffer.syncRevision}`}
            markdown={content}
            onChange={(markdown) => setContent(buffer.id, markdown)}
            showToolbar={showEditorToolbar}
            onOutlineChange={setOutline}
            readScrollTop={() =>
              scrollKey === null
                ? undefined
                : useFileAccessStore.getState().scrollTops[scrollKey]
            }
            onScrollTopSave={(scrollTop) => {
              if (scrollKey !== null) {
                setScrollTop(scrollKey, scrollTop);
              }
            }}
            images={images}
          />
        </EditorFileDropZone>
      )}
    </div>
  );
}
