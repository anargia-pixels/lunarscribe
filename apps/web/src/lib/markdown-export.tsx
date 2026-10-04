import { MarkdownPreview } from "@lunarscribe/components/editor/markdown-preview";
import { createRoot } from "react-dom/client";

import type { FileTarget } from "@/lib/editor-files";
import { isTextFile, stemOf } from "@/lib/editor-files";
import { readExternalFile } from "@/lib/external-files";
import { readFile } from "@/lib/saved-files";
import { useBufferStore } from "@/stores/buffer-store";

type MarkdownSnapshotExporter<Result> = (
  root: HTMLElement,
  title: string,
) => Promise<Result>;

/** Render an unopened buffer without selecting it or exposing editor controls. */
async function renderMarkdownSnapshot<Result>(
  markdown: string,
  title: string,
  exportSnapshot: MarkdownSnapshotExporter<Result>,
) {
  const host = document.createElement("div");

  host.inert = true;
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;width:calc(210mm - 36mm);pointer-events:none";
  document.body.append(host);

  let timeoutId: number | undefined;
  let rejectRender: (error: Error) => void = () => {};

  const root = createRoot(host, {
    onUncaughtError: () =>
      rejectRender(new Error("Unable to render markdown for export.")),
  });

  try {
    const editorRoot = await new Promise<HTMLElement>((resolve, reject) => {
      rejectRender = reject;
      timeoutId = window.setTimeout(
        () => reject(new Error("Rendering timed out. Try exporting again.")),
        15000,
      );
      root.render(
        <MarkdownPreview
          markdown={markdown}
          onReady={resolve}
          onError={reject}
        />,
      );
    });

    window.clearTimeout(timeoutId);

    return await exportSnapshot(editorRoot, title);
  } finally {
    window.clearTimeout(timeoutId);
    root.unmount();
    host.remove();
  }
}

/** Both export formats use current edits, falling back to storage for unopened entries. */
export async function withMarkdownSnapshot<Result>(
  target: FileTarget,
  exportSnapshot: MarkdownSnapshotExporter<Result>,
) {
  if (!isTextFile(target.name)) {
    throw new Error("Only markdown can be exported.");
  }

  const state = useBufferStore.getState();

  const buffer = state.buffers.find((candidate) =>
    target.kind === "saved"
      ? candidate.fileName === target.name
      : candidate.externalId === target.id,
  );

  let markdown = buffer?.content;

  if (markdown === undefined) {
    if (target.kind === "saved") {
      markdown = await readFile(target.name);
    } else {
      markdown = (await readExternalFile(target.id)).markdown;
    }
  }

  const title = buffer?.title ?? stemOf(target.name);

  const activeRoot =
    buffer?.id === state.activeId
      ? document.querySelector<HTMLElement>("[data-markdown-editor]")
      : null;

  // Exclude block editing controls and wait for asynchronous diagram rendering.
  if (
    activeRoot &&
    !activeRoot.querySelector("[data-math-source], [data-mermaid-render]")
  ) {
    return exportSnapshot(activeRoot, title);
  }

  return renderMarkdownSnapshot(markdown, title, exportSnapshot);
}
