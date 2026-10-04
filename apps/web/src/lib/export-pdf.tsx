import { createPdfHtml } from "@lunarscribe/components/lib/pdf-html";

import type { FileTarget } from "@/lib/editor-files";
import { withMarkdownSnapshot } from "@/lib/markdown-export";

/** Fit wide blocks to the page and let only blocks taller than a page split across pages. */
function preparePdfLayout(pdf: Document) {
  const probe = pdf.createElement("div");
  probe.style.height = "var(--pdf-page-height)";
  pdf.body.append(probe);
  const pageHeight = probe.getBoundingClientRect().height;
  probe.remove();

  const root = pdf.getElementById("pdf-markdown");

  if (!root) {
    throw new Error("Unable to render markdown for PDF export.");
  }

  // Scale exceptionally wide tables and equations rather than cropping them.
  for (const element of root.querySelectorAll<HTMLElement>(
    "table, .katex-display",
  )) {
    const availableWidth = element.parentElement?.clientWidth ?? 0;

    if (element.scrollWidth > availableWidth) {
      element.style.zoom = String(availableWidth / element.scrollWidth);
    }
  }

  for (const block of root.querySelectorAll(
    ":scope > *, p, li, tr, blockquote, ul, ol, table, code.block, .editor-math-block",
  )) {
    if (block.getBoundingClientRect().height > pageHeight) {
      block.setAttribute("data-pdf-splittable", "");
    }
  }
}

/** Prints a static snapshot from a hidden frame; the browser's dialog saves the PDF. */
async function printPdfHtml(html: string) {
  const frame = document.createElement("iframe");

  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-100000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden";

  const loaded = new Promise<void>((resolve) =>
    frame.addEventListener("load", () => resolve(), { once: true }),
  );

  frame.srcdoc = html;
  document.body.append(frame);

  try {
    await loaded;

    const view = frame.contentWindow;
    const pdf = frame.contentDocument;

    if (!view || !pdf) {
      throw new Error("Unable to prepare the PDF.");
    }

    await pdf.fonts.ready;
    await Promise.all(
      Array.from(pdf.images, (image) => image.decode().catch(() => undefined)),
    );
    preparePdfLayout(pdf);

    const printed = new Promise<void>((resolve) =>
      view.addEventListener("afterprint", () => resolve(), { once: true }),
    );

    view.focus();
    view.print();
    // Chromium blocks in print(); other browsers return at once and fire afterprint later.
    await Promise.race([
      printed,
      new Promise((resolve) => setTimeout(resolve, 60_000)),
    ]);
  } finally {
    frame.remove();
  }
}

/** Export current buffer edits through the print dialog; returns no path to report. */
export function exportPdf(target: FileTarget) {
  return withMarkdownSnapshot(target, async (root, title) => {
    await printPdfHtml(createPdfHtml(root, title));

    return null;
  });
}
