import "@excalidraw/excalidraw/index.css";
import "./drawing-editor.css";
import {
  Excalidraw,
  hashElementsVersion,
  restore,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export type DrawingEditorProps = {
  scene: string;
  theme: "light" | "dark";
  onChange: (scene: string) => void;
};

/** Parses and validates a saved scene; an empty or unreadable one opens a blank canvas. */
function parseScene(scene: string): ExcalidrawInitialDataState | null {
  if (!scene) {
    return null;
  }

  try {
    const data = JSON.parse(scene);

    // Saved collaborators are a plain object, but Excalidraw iterates them as a Map and crashes.
    return restore(
      { ...data, appState: { ...data.appState, collaborators: undefined } },
      null,
      null,
    );
  } catch {
    return null;
  }
}

/** Excalidraw canvas for a drawing; reports the scene as JSON whenever its elements change. */
export function DrawingEditor({ scene, theme, onChange }: DrawingEditorProps) {
  // Excalidraw owns the scene after mount, so the saved one is only read once.
  const [initialData] = useState(() => parseScene(scene));

  const elementsVersion = useRef(
    hashElementsVersion(initialData?.elements ?? []),
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);

  // Excalidraw sizes its canvas from state set by its own ResizeObserver, which React
  // renders after the next paint, so the canvas trails window resizes and the sidebar
  // animation. Apply the new size synchronously so it lands in the same frame.
  useEffect(() => {
    // The element Excalidraw measures for its own size and pointer offsets.
    const container = wrapperRef.current?.querySelector(
      ".excalidraw-container",
    );

    if (!api || !container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      const { width, height, left, top } = container.getBoundingClientRect();
      const appState = api.getAppState();

      if (
        appState.width === width &&
        appState.height === height &&
        appState.offsetLeft === left &&
        appState.offsetTop === top
      ) {
        return;
      }

      flushSync(() => {
        api.updateScene({
          appState: { width, height, offsetLeft: left, offsetTop: top },
        });
      });
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [api]);

  return (
    <div ref={wrapperRef} className="min-h-0 flex-1">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        theme={theme}
        onChange={(elements, appState, files) => {
          // Mid-gesture edits fire on every pointer move; serializing the whole scene each
          // frame stalls drawing, so wait for the gesture to finish.
          if (
            appState.newElement ||
            appState.multiElement ||
            appState.resizingElement ||
            appState.selectedElementsAreBeingDragged ||
            appState.isRotating
          ) {
            return;
          }

          // onChange also fires for pointer moves and selection; only element edits count.
          const version = hashElementsVersion(elements);

          if (version === elementsVersion.current) {
            return;
          }

          elementsVersion.current = version;
          onChange(serializeAsJSON(elements, appState, files, "local"));
        }}
      />
    </div>
  );
}
