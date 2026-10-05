import type { LayoutRectangle } from "react-native";
import { create } from "zustand";

import type { EditorKind } from "@/lib/editor-types";

/** Links the editor screen to the editor host. */
type EditorHostState = {
  slot: LayoutRectangle | null; // window coordinates; null when no editor shows
  isLoaded: Record<EditorKind, boolean>; // editors whose page has loaded
};

export const useEditorHostStore = create<EditorHostState>(() => ({
  slot: null,
  isLoaded: { markdown: false, drawing: false },
}));
