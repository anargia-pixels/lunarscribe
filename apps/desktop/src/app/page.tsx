import { MarkdownEditor } from "@lunarscribe/components/editor/markdown-editor";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Input } from "@lunarscribe/components/ui/input";
import { SidebarTrigger } from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";

import { ModeToggle } from "@/components/mode-toggle";
import {
  toBufferTitle,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";

/** Editor page for the active buffer. */
export default function Page() {
  const buffer = useActiveBuffer();
  const renameBuffer = useBufferStore((state) => state.renameBuffer);
  const setMarkdown = useBufferStore((state) => state.setMarkdown);

  if (!buffer) {
    return null;
  }

  return (
    <div className="flex h-svh flex-col">
      {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
      <TooltipProvider delay={800} timeout={300}>
        <header className="relative flex h-12 shrink-0 items-center justify-center border-b px-12">
          <Hint label="Toggle sidebar" side="bottom">
            <SidebarTrigger className="absolute left-3" />
          </Hint>
          <Input
            aria-label="Buffer title"
            value={buffer.title}
            onChange={(event) => {
              const input = event.target;
              const caret = input.selectionStart;

              // Rewrite the field in place so React doesn't reset the caret to the end.
              input.value = toBufferTitle(input.value);
              input.setSelectionRange(caret, caret);
              renameBuffer(buffer.id, input.value);
            }}
            className="h-8 max-w-sm text-center"
          />
          <div className="absolute right-3">
            <ModeToggle />
          </div>
        </header>
      </TooltipProvider>
      <MarkdownEditor
        key={buffer.id}
        markdown={buffer.markdown}
        onChange={(markdown) => setMarkdown(buffer.id, markdown)}
      />
    </div>
  );
}
