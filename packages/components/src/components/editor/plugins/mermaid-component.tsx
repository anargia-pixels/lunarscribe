import "./mermaid-plugin.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { Button } from "@lunarscribe/components/ui/button";
import { Textarea } from "@lunarscribe/components/ui/textarea";
import {
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  type NodeKey,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { $isMermaidNode } from "./mermaid-node";
import { MermaidPreview } from "./mermaid-preview";

export function MermaidComponent({
  code,
  nodeKey,
}: {
  code: string;
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [editing, setEditing] = useState(() =>
    editor.getEditorState().read(() => {
      const selection = $getSelection();

      return $isNodeSelection(selection) && selection.has(nodeKey);
    }),
  );

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();

          // Native textarea selection can clear Lexical's selection; blur closes editing.
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
    [editor, nodeKey],
  );

  useEffect(() => {
    if (editing && editable) {
      inputRef.current?.focus();
    }
  }, [editing, editable]);

  const finish = () => {
    setEditing(false);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);

      if (!$isMermaidNode(node)) {
        return;
      }

      if (!node.getNextSibling()) {
        const paragraph = $createParagraphNode();

        node.insertAfter(paragraph);
        paragraph.select();
      } else {
        node.selectNext();
      }
    });
    editor.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
    } else if (
      event.key === "Escape" ||
      (event.key === "Enter" && (event.metaKey || event.ctrlKey))
    ) {
      event.preventDefault();
      finish();
    } else if (
      code === "" &&
      (event.key === "Backspace" || event.key === "Delete")
    ) {
      event.preventDefault();
      setEditing(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);

        if ($isMermaidNode(node)) {
          const paragraph = $createParagraphNode();

          node.replace(paragraph);
          paragraph.select();
        }
      });
      editor.focus();
    }
  };

  return (
    <div
      contentEditable={false}
      data-mermaid-source={editing && editable ? "" : undefined}
    >
      {editing && editable && (
        <Textarea
          ref={inputRef}
          aria-label="Mermaid block text"
          value={code}
          spellCheck={false}
          onChange={(event) => {
            const value = event.currentTarget.value;

            editor.update(() => {
              const node = $getNodeByKey(nodeKey);

              if ($isMermaidNode(node)) {
                node.setCode(value);
              }
            });
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => event.stopPropagation()}
        />
      )}
      {editable ? (
        <Button
          variant="ghost"
          data-mermaid-preview
          aria-label="Edit Mermaid block"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.shiftKey) {
              return;
            }

            editor.update(() => {
              const selection = $createNodeSelection();

              selection.add(nodeKey);
              $setSelection(selection);
            });
            setEditing(true);
            inputRef.current?.focus();
          }}
        >
          <MermaidPreview code={code} />
        </Button>
      ) : (
        <MermaidPreview code={code} />
      )}
    </div>
  );
}
