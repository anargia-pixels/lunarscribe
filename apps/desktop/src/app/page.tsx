import { MarkdownEditor } from "@lunarscribe/components/editor/markdown-editor";
import { Input } from "@lunarscribe/components/ui/input";
import { SidebarTrigger } from "@lunarscribe/components/ui/sidebar";

import { ModeToggle } from "@/components/mode-toggle";
import { useActiveBuffer, useBufferStore } from "@/stores/buffer-store";

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
      <header className="relative flex h-12 shrink-0 items-center justify-center border-b px-12">
        <SidebarTrigger className="absolute left-3" />
        <Input
          aria-label="Buffer title"
          value={buffer.title}
          onChange={(event) => renameBuffer(buffer.id, event.target.value)}
          className="h-8 max-w-sm text-center"
        />
        <div className="absolute right-3">
          <ModeToggle />
        </div>
      </header>
      <MarkdownEditor
        key={buffer.id}
        markdown={buffer.markdown}
        onChange={(markdown) => setMarkdown(buffer.id, markdown)}
      />
    </div>
  );
}
