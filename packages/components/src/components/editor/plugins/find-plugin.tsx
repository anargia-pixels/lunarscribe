import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import { Card, CardContent } from "@lunarscribe/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
} from "@lunarscribe/components/ui/collapsible";
import { Input } from "@lunarscribe/components/ui/input";
import { Toggle } from "@lunarscribe/components/ui/toggle";
import {
  $createRangeSelection,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type LexicalEditor,
  SKIP_DOM_SELECTION_TAG,
} from "lexical";
import { ArrowDown, ArrowUp, CaseSensitive, WholeWord, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { $findMatches, $getMatchRange, type FindMatch } from "./find-matches";

import "./find-plugin.css";

function selectMatch(
  editor: LexicalEditor,
  match: FindMatch,
  panel: HTMLDivElement | null,
) {
  editor.update(
    () => {
      const start = $getNodeByKey(match.startKey);
      const end = $getNodeByKey(match.endKey);

      if ($isTextNode(start) && $isTextNode(end)) {
        const selection = $createRangeSelection();

        selection.setTextNodeRange(
          start,
          match.startOffset,
          end,
          match.endOffset,
        );

        $setSelection(selection);
      }
    },
    // Keep typing in the find input while Lexical remembers the selected match.
    { tag: SKIP_DOM_SELECTION_TAG },
  );

  editor.read(() => {
    const range = $getMatchRange(editor, match);

    const viewport = editor
      .getRootElement()
      ?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');

    if (!range || !viewport) {
      return;
    }

    const rect = range.getBoundingClientRect();

    const bounds = viewport.getBoundingClientRect();

    const top = Math.max(
      bounds.top,
      panel?.getBoundingClientRect().bottom ?? 0,
    );

    if (rect.top < top || rect.bottom > bounds.bottom) {
      viewport.scrollTop += rect.top - top - (bounds.bottom - top) / 2;
    }
  });
}

/** Persistent find panel for the active buffer; search never changes markdown. */
export function FindPlugin() {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const subscribe = useCallback(
    (onChange: () => void) =>
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size || dirtyLeaves.size) {
          onChange();
        }
      }),
    [editor],
  );

  const getSnapshot = useCallback(() => editor.getEditorState(), [editor]);
  const editorState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const matches = useMemo(
    () =>
      open
        ? editorState.read(() => $findMatches(query, matchCase, wholeWord))
        : [],
    [editorState, matchCase, open, query, wholeWord],
  );

  const activeIndex = Math.min(index, matches.length - 1);

  const updateSearch = useCallback(
    (nextQuery: string, nextMatchCase: boolean, nextWholeWord: boolean) => {
      setQuery(nextQuery);
      setMatchCase(nextMatchCase);
      setWholeWord(nextWholeWord);
      setIndex(0);

      const nextMatches = editor.read(() =>
        $findMatches(nextQuery, nextMatchCase, nextWholeWord),
      );

      if (nextMatches[0]) {
        selectMatch(editor, nextMatches[0], panelRef.current);
      }
    },
    [editor],
  );

  const close = useCallback(() => {
    const restoreFocus = panelRef.current?.contains(document.activeElement);

    setOpen(false);

    if (restoreFocus) {
      editor.focus();
    }
  }, [editor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        (event.target instanceof Element &&
          event.target.closest('[role="dialog"], [role="alertdialog"]'))
      ) {
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();

        const selectedText = editor.read(() => {
          const selection = $getSelection();

          return editor.getRootElement()?.contains(document.activeElement) &&
            $isRangeSelection(selection)
            ? selection.getTextContent()
            : "";
        });

        updateSearch(
          selectedText && !selectedText.includes("\n") ? selectedText : query,
          matchCase,
          wholeWord,
        );
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (open && event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, editor, matchCase, open, query, updateSearch, wholeWord]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const all = new Highlight();
    const active = new Highlight();

    active.priority = 1;
    editor.read(() => {
      for (const [matchIndex, match] of matches.entries()) {
        const range = $getMatchRange(editor, match);

        if (range) {
          all.add(range);

          if (matchIndex === activeIndex) {
            active.add(range);
          }
        }
      }
    });
    CSS.highlights.set("editor-find", all);
    CSS.highlights.set("editor-find-active", active);

    return () => {
      CSS.highlights.delete("editor-find");
      CSS.highlights.delete("editor-find-active");
    };
  }, [activeIndex, editor, matches, open]);

  const navigate = (direction: number) => {
    const count = matches.length;

    if (!count) {
      return;
    }

    const nextIndex = (activeIndex + direction + count) % count;
    const match = matches[nextIndex];

    setIndex(nextIndex);

    if (match) {
      selectMatch(editor, match, panelRef.current);
    }
  };

  return (
    <Collapsible
      open={open}
      className="absolute top-2 right-4 left-4 z-20 sm:left-auto"
    >
      <CollapsibleContent ref={panelRef}>
        <search aria-label="Find in buffer">
          <Card size="xs">
            <CardContent>
              <div className="flex flex-wrap items-center gap-0.5 text-sm">
                <Input
                  density="compact"
                  ref={inputRef}
                  aria-label="Find"
                  placeholder="Find"
                  value={query}
                  aria-invalid={Boolean(query) && !matches.length}
                  className="min-w-24 flex-1 sm:w-48"
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      navigate(event.shiftKey ? -1 : 1);
                    }
                  }}
                  onChange={(event) =>
                    updateSearch(event.target.value, matchCase, wholeWord)
                  }
                />
                <Hint label="Match case">
                  <Toggle
                    size="icon-sm"
                    aria-label="Match case"
                    pressed={matchCase}
                    onPressedChange={(pressed) =>
                      updateSearch(query, pressed, wholeWord)
                    }
                  >
                    <CaseSensitive />
                  </Toggle>
                </Hint>
                <Hint label="Match whole word">
                  <Toggle
                    size="icon-sm"
                    aria-label="Match whole word"
                    pressed={wholeWord}
                    onPressedChange={(pressed) =>
                      updateSearch(query, matchCase, pressed)
                    }
                  >
                    <WholeWord />
                  </Toggle>
                </Hint>
                <output
                  aria-live="polite"
                  className="min-w-14 text-center text-sm tabular-nums"
                >
                  {query
                    ? matches.length
                      ? `${activeIndex + 1} of ${matches.length}`
                      : "No results"
                    : ""}
                </output>
                <Hint label="Previous match" shortcut={["⇧", "Enter"]}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous match"
                    disabled={!matches.length}
                    onClick={() => navigate(-1)}
                  >
                    <ArrowUp />
                  </Button>
                </Hint>
                <Hint label="Next match (Enter)">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next match"
                    disabled={!matches.length}
                    onClick={() => navigate(1)}
                  >
                    <ArrowDown />
                  </Button>
                </Hint>
                <Hint label="Close find (Esc)">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close find"
                    onClick={close}
                  >
                    <X />
                  </Button>
                </Hint>
              </div>
            </CardContent>
          </Card>
        </search>
      </CollapsibleContent>
    </Collapsible>
  );
}
