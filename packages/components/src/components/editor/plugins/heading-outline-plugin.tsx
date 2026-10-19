import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { NodeKey } from "lexical";
import { useEffect, useEffectEvent } from "react";

import {
  $getHeadingAnchors,
  goToHeading,
  type HeadingAnchor,
} from "../heading-anchors";

/** The buffer's headings and a way to jump to one. */
export type Outline = {
  headings: HeadingAnchor[];
  goToHeading: (key: NodeKey) => void;
};

/** Reports the outline whenever the headings change, and null on unmount. */
export function HeadingOutlinePlugin({
  onChange,
}: {
  onChange: (outline: Outline | null) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const report = useEffectEvent(onChange);

  useEffect(() => {
    let previous = "";

    const goTo = (key: NodeKey) => {
      goToHeading(editor, key);
      editor.focus();
    };

    const update = () => {
      const headings = editor.read($getHeadingAnchors);
      const next = JSON.stringify(headings);

      if (next !== previous) {
        previous = next;
        report({ headings, goToHeading: goTo });
      }
    };

    update();

    const unregister = editor.registerUpdateListener(update);

    return () => {
      unregister();
      report(null);
    };
  }, [editor]);

  return null;
}
