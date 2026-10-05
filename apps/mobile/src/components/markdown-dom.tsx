"use dom";

import "./editor-dom-page.css";
import { MarkdownMobileEditor } from "@lunarscribe/components/editor/markdown-mobile-editor";

import type { EditorDomProps } from "@/components/editor-dom-props";
import { useEditorDomPage } from "@/components/use-editor-dom-page";

/** The shared markdown editor needs a DOM, so Expo runs it in a WebView. */
export default function MarkdownDom({
  content,
  contentKey,
  theme,
  palette,
  isShown,
  onChange,
}: EditorDomProps) {
  useEditorDomPage(theme, palette, isShown);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <MarkdownMobileEditor
        key={contentKey}
        markdown={content}
        onChange={onChange}
      />
    </div>
  );
}
