"use dom";

import "./editor-dom-page.css";
import { DrawingEditor } from "@lunarscribe/components/editor/drawing-editor";

import type { EditorDomProps } from "@/components/editor-dom-props";
import { useEditorDomPage } from "@/components/use-editor-dom-page";

/** The shared drawing editor needs a DOM, so Expo runs it in a WebView. */
export default function DrawingDom({
  content,
  contentKey,
  theme,
  onChange,
}: EditorDomProps) {
  useEditorDomPage(theme);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <DrawingEditor
        key={contentKey}
        scene={content}
        theme={theme}
        onChange={onChange}
      />
    </div>
  );
}
