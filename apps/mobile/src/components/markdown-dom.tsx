"use dom";

import "./editor-dom-page.css";
import type {
  EditorImages,
  ImageSource,
} from "@lunarscribe/components/editor/markdown-editor";
import { MarkdownMobileEditor } from "@lunarscribe/components/editor/markdown-mobile-editor";
import { useMemo } from "react";

import type { EditorDomProps } from "@/components/editor-dom-props";
import { useEditorDomPage } from "@/components/use-editor-dom-page";

// Images this page already received, for one buffer and image revision. Expo sends a
// new function with every prop update, so caching here sends each data URL only once.
let cachedPage = "";

const cachedImages = new Map<string, Promise<ImageSource>>();

function cachedImage(
  page: string,
  target: string,
  resolveImage: EditorDomProps["resolveImage"],
) {
  if (page !== cachedPage) {
    cachedPage = page;
    cachedImages.clear();
  }

  let source = cachedImages.get(target);

  if (!source) {
    source = resolveImage
      ? resolveImage(target)
      : Promise.resolve<ImageSource>({ status: "missing" });
    cachedImages.set(target, source);
    // A failed read is tried again next time.
    source.catch(() => cachedImages.delete(target));
  }

  return source;
}

/** The shared markdown editor needs a DOM, so Expo runs it in a WebView. */
export default function MarkdownDom({
  content,
  contentKey,
  theme,
  palette,
  isShown,
  onChange,
  isOutlineOpen,
  onOutlineOpenChange,
  resolveImage,
  imageRevision = 0,
}: EditorDomProps) {
  useEditorDomPage(theme, palette, isShown);

  const images = useMemo<EditorImages>(
    () => ({
      resolveImage: (target) =>
        cachedImage(`${contentKey}\0${imageRevision}`, target, resolveImage),
      revision: imageRevision,
    }),
    [contentKey, imageRevision, resolveImage],
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <MarkdownMobileEditor
        key={contentKey}
        markdown={content}
        onChange={onChange}
        isOutlineOpen={isOutlineOpen}
        onOutlineOpenChange={onOutlineOpenChange}
        images={images}
      />
    </div>
  );
}
