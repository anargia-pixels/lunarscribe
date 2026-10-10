import {
  $createLinkNode,
  $isLinkNode,
  $toggleLink,
  type LinkNode,
} from "@lexical/link";
import { $findMatchingParent } from "@lexical/utils";
import { Button } from "@lunarscribe/components/ui/button";
import { Input } from "@lunarscribe/components/ui/input";
import { $createTextNode, $getSelection, $isRangeSelection } from "lexical";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export type LinkDraft = { text: string; url: string; isLink: boolean };

/** The link around the selection's anchor, if any. */
export function $getSelectedLink(): LinkNode | null {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return null;
  }

  const link = $findMatchingParent(selection.anchor.getNode(), $isLinkNode);

  return $isLinkNode(link) ? link : null;
}

/** What the link form starts with: the link around the selection, or the selected text. */
export function $getLinkDraft(): LinkDraft {
  const link = $getSelectedLink();

  if (link) {
    return { text: link.getTextContent(), url: link.getURL(), isLink: true };
  }

  const selection = $getSelection();

  return {
    text: $isRangeSelection(selection) ? selection.getTextContent() : "",
    url: "",
    isLink: false,
  };
}

/**
 * Updates the link around the selection, links the selected text, or inserts
 * a new link. Empty text falls back to the URL.
 */
export function $applyLink(text: string, url: string) {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return;
  }

  const label = text || url;
  const link = $getSelectedLink();

  if (link) {
    link.setURL(url);

    // Rewriting the text drops formatting inside the link, so keep it unless
    // the text changed.
    if (label !== link.getTextContent()) {
      const children = link.getChildren();

      link.append($createTextNode(label)).selectEnd();

      for (const child of children) {
        child.remove();
      }
    }

    return;
  }

  if (!selection.isCollapsed() && label === selection.getTextContent()) {
    $toggleLink(url);

    return;
  }

  selection.insertNodes([$createLinkNode(url).append($createTextNode(label))]);
}

/** Turns the link around the selection back into plain text. */
export function $removeLink() {
  const link = $getSelectedLink();

  if (!link) {
    $toggleLink(null);

    return;
  }

  for (const child of link.getChildren()) {
    link.insertBefore(child);
  }

  link.remove();
}

/** Link text and URL fields. Saving an empty URL removes an existing link. */
export function LinkForm({
  draft,
  onSubmit,
  onRemove,
  onCancel,
}: {
  draft: LinkDraft;
  onSubmit: (text: string, url: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(draft.text);
  const [url, setUrl] = useState(draft.url);
  const [focusUrl] = useState(draft.text !== "");
  const textRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (focusUrl ? urlRef : textRef).current?.focus();
  }, [focusUrl]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextUrl = url.trim();

    if (nextUrl) {
      onSubmit(text.trim(), nextUrl);
    } else if (draft.isLink) {
      onRemove();
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <Input
        ref={textRef}
        aria-label="Link text"
        placeholder="Text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Input
        ref={urlRef}
        inputMode="url"
        aria-label="Link URL"
        placeholder="https://"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="flex justify-end gap-1">
        {draft.isLink && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        )}
        <Button type="submit" size="sm">
          {draft.isLink ? "Update" : "Add link"}
        </Button>
      </div>
    </form>
  );
}
