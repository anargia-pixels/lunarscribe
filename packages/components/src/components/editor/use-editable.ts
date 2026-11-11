import type { LexicalEditor } from "lexical";
import { useSyncExternalStore } from "react";

/** Whether the editor accepts edits; view only turns this off. */
export function useEditable(editor: LexicalEditor) {
  return useSyncExternalStore(
    (onChange) => editor.registerEditableListener(onChange),
    () => editor.isEditable(),
  );
}
