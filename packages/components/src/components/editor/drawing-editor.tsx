import "@excalidraw/excalidraw/index.css";
import {
  Excalidraw,
  hashElementsVersion,
  restore,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useRef, useState } from "react";

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
export function DrawingEditor({
  scene,
  theme,
  onChange,
}: {
  scene: string;
  theme: "light" | "dark";
  onChange: (scene: string) => void;
}) {
  // Excalidraw owns the scene after mount, so the saved one is only read once.
  const [initialData] = useState(() => parseScene(scene));

  const elementsVersion = useRef(
    hashElementsVersion(initialData?.elements ?? []),
  );

  return (
    <div className="min-h-0 flex-1">
      <Excalidraw
        initialData={initialData}
        theme={theme}
        onChange={(elements, appState, files) => {
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
