import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { Button } from "@lunarscribe/components/ui/button";
import { Input } from "@lunarscribe/components/ui/input";
import { Textarea } from "@lunarscribe/components/ui/textarea";
import katex from "katex";
import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  mergeRegister,
  type NodeKey,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { $isMathNode } from "./math-node";

type MathPreviewProps = {
  equation: string;
  inline: boolean;
};

function MathPreview({ equation, inline }: MathPreviewProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(equation, ref.current, {
        displayMode: !inline,
        throwOnError: false,
        trust: false,
      });
    }
  }, [equation, inline]);

  return <span data-math-render ref={ref} />;
}

export function MathComponent({
  equation,
  inline,
  nodeKey,
}: MathPreviewProps & { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const [editing, setEditing] = useState(() =>
    editor.getEditorState().read(() => {
      const selection = $getSelection();

      return $isNodeSelection(selection) && selection.has(nodeKey);
    }),
  );

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          CLICK_COMMAND,
          (event) => {
            const element = editor.getElementByKey(nodeKey);

            if (
              !editor.isEditable() ||
              event.shiftKey ||
              !(event.target instanceof Node) ||
              !element?.contains(event.target) ||
              event.target instanceof HTMLInputElement ||
              event.target instanceof HTMLTextAreaElement
            ) {
              return false;
            }

            const selection = $createNodeSelection();

            selection.add(nodeKey);
            $setSelection(selection);
            setEditing(true);

            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            const selection = $getSelection();

            if (
              editor.isEditable() &&
              editor.getRootElement()?.contains(document.activeElement) &&
              $isNodeSelection(selection) &&
              selection.has(nodeKey) &&
              selection.getNodes().length === 1
            ) {
              setEditing(true);
            }
          });
        }),
      ),
    [editor, nodeKey],
  );

  useEffect(() => {
    if (editing && editable) {
      inputRef.current?.focus();
    }
  }, [editing, editable]);

  const finish = (before: boolean) => {
    setEditing(false);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);

      if (!$isMathNode(node)) {
        return;
      }

      const sibling = before
        ? node.getPreviousSibling()
        : node.getNextSibling();

      if (!inline && !sibling) {
        const paragraph = $createParagraphNode();

        if (before) {
          node.insertBefore(paragraph);
        } else {
          node.insertAfter(paragraph);
        }

        paragraph.select();
      } else if (before) {
        node.selectPrevious();
      } else {
        node.selectNext();
      }
    });
    editor.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // The source control owns its keys; Lexical must not also apply shortcuts.
    event.stopPropagation();

    if (event.nativeEvent.isComposing) {
      return;
    }

    const key = event.key.toLowerCase();

    if (
      ((event.metaKey || event.ctrlKey) && key === "z") ||
      (event.ctrlKey && key === "y")
    ) {
      event.preventDefault();
      editor.dispatchCommand(
        event.shiftKey || key === "y" ? REDO_COMMAND : UNDO_COMMAND,
        undefined,
      );

      return;
    }

    if (
      event.key === "Escape" ||
      (event.key === "Enter" && (inline || event.metaKey || event.ctrlKey))
    ) {
      event.preventDefault();
      finish(false);
    } else if (
      inline &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      ((event.key === "ArrowLeft" && event.currentTarget.selectionEnd === 0) ||
        (event.key === "ArrowRight" &&
          event.currentTarget.selectionStart === equation.length))
    ) {
      event.preventDefault();
      finish(event.key === "ArrowLeft");
    } else if (
      equation === "" &&
      (event.key === "Backspace" || event.key === "Delete")
    ) {
      event.preventDefault();
      setEditing(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);

        if ($isMathNode(node)) {
          const replacement = inline
            ? $createTextNode()
            : $createParagraphNode();

          node.replace(replacement);
          replacement.select();
        }
      });
      editor.focus();
    }
  };

  const sourceProps = {
    "aria-label": inline ? "Inline math LaTeX" : "Block math LaTeX",
    value: equation,
    spellCheck: false,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.currentTarget.value;

      editor.update(() => {
        const node = $getNodeByKey(nodeKey);

        if ($isMathNode(node)) {
          node.setEquation(value);
        }
      });
    },
    onBlur: () => setEditing(false),
    onKeyDown: handleKeyDown,
  };

  if (editing && editable) {
    return (
      <span data-math-source contentEditable={false}>
        <span aria-hidden="true">{inline ? "$" : "$$"}</span>
        {inline ? (
          <Input
            {...sourceProps}
            ref={(element) => {
              inputRef.current = element;
            }}
            density="compact"
          />
        ) : (
          <Textarea
            {...sourceProps}
            ref={(element) => {
              inputRef.current = element;
            }}
          />
        )}
        <span aria-hidden="true">{inline ? "$" : "$$"}</span>
        {!inline && <MathPreview equation={equation} inline={false} />}
      </span>
    );
  }

  if (!editable) {
    return <MathPreview equation={equation} inline={inline} />;
  }

  return (
    <Button
      variant="ghost"
      data-math-preview
      aria-label={`Edit ${inline ? "inline" : "block"} math: ${equation}`}
      onClick={() => setEditing(true)}
    >
      <MathPreview equation={equation} inline={inline} />
    </Button>
  );
}
