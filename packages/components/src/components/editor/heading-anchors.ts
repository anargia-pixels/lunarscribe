import { $isHeadingNode } from "@lexical/rich-text";
import {
  $getNodeByKey,
  $getRoot,
  type LexicalEditor,
  type NodeKey,
} from "lexical";

/** A heading a `#slug` link can point to; `level` is 1 for `h1` through 6 for `h6`. */
export type HeadingAnchor = {
  key: NodeKey;
  slug: string;
  text: string;
  level: number;
};

/** GitHub's heading slug: lowercase, punctuation dropped, each space a hyphen. */
export function slugifyHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replaceAll(/\s/gu, "-");
}

/** Every heading's slug in document order; repeats get `-1`, `-2`, ... like GitHub. */
export function $getHeadingAnchors(): HeadingAnchor[] {
  const counts = new Map<string, number>();

  return $getRoot()
    .getChildren()
    .filter($isHeadingNode)
    .map((heading) => {
      const text = heading.getTextContent();
      const base = slugifyHeading(text);
      const count = counts.get(base) ?? 0;

      counts.set(base, count + 1);

      return {
        key: heading.getKey(),
        slug: count ? `${base}-${count}` : base,
        text,
        level: Number(heading.getTag().slice(1)),
      };
    });
}

/** Moves the caret to the start of a heading and scrolls it to the top. */
export function goToHeading(editor: LexicalEditor, key: NodeKey) {
  editor.update(
    // A caret inside a collapsed section expands it before the scroll.
    () => $getNodeByKey(key)?.selectStart(),
    {
      onUpdate: () =>
        requestAnimationFrame(() =>
          editor
            .getElementByKey(key)
            ?.scrollIntoView({ block: "start", behavior: "smooth" }),
        ),
    },
  );
}
