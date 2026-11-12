import type { LexicalEditor } from "lexical";
import { useState, useSyncExternalStore } from "react";

/** Whether the editor accepts edits; view only turns this off. */
export function useEditable(editor: LexicalEditor) {
  return useSyncExternalStore(
    (onChange) => editor.registerEditableListener(onChange),
    () => editor.isEditable(),
  );
}

/**
 * View only as its control shows it, and a setter for that control. Switching
 * restyles the whole buffer, which on a phone takes long enough that a control
 * waiting for it feels stuck, so the control updates at once and the editor
 * switches after that paint.
 */
export function useViewOnly(editor: LexicalEditor) {
  const isEditable = useEditable(editor);
  const [pending, setPending] = useState<boolean | null>(null);

  const setViewOnly = (viewOnly: boolean) => {
    setPending(viewOnly);
    // A timeout started in an animation frame runs after that frame's paint.
    requestAnimationFrame(() =>
      setTimeout(() => {
        editor.setEditable(!viewOnly);
        setPending(null);
      }),
    );
  };

  return [pending ?? !isEditable, setViewOnly] as const;
}
