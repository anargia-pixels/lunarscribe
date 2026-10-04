import { createPdfHtml } from "@lunarscribe/components/lib/pdf-html";

import type { FileTarget } from "@/lib/editor-files";
import { withMarkdownSnapshot } from "@/lib/markdown-export";

/** Export current buffer edits, falling back to disk for an unopened sidebar entry. */
export function exportPdf(target: FileTarget) {
  return withMarkdownSnapshot(target, (root, title) =>
    window.lunarscribe.exportPdf(title, createPdfHtml(root, title)),
  );
}
