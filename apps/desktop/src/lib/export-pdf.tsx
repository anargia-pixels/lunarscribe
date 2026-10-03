import type { FileTarget } from "@/lib/editor-files";
import { withMarkdownSnapshot } from "@/lib/markdown-export";

import pdfStyles from "./pdf-export.css?inline";

/** Capture the live theme and loaded stylesheets alongside the rendered markdown. */
function createPdfHtml(editorRoot: HTMLElement, title: string) {
  const pdf = document.implementation.createHTMLDocument(title);
  const charset = pdf.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  pdf.head.prepend(charset);

  const base = pdf.createElement("base");

  base.href = document.baseURI;
  pdf.head.append(base);
  pdf.documentElement.className = document.documentElement.className;
  pdf.documentElement.style.cssText = document.documentElement.style.cssText;
  pdf.documentElement.style.fontSize = getComputedStyle(
    document.documentElement,
  ).fontSize;

  for (const stylesheet of document.querySelectorAll(
    'style, link[rel="stylesheet"]',
  )) {
    const clone = stylesheet.cloneNode(true);

    if (
      clone instanceof HTMLLinkElement &&
      stylesheet instanceof HTMLLinkElement
    ) {
      clone.href = stylesheet.href;
    }

    pdf.head.append(clone);
  }

  const printStyle = pdf.createElement("style");
  printStyle.textContent = pdfStyles;
  pdf.head.append(printStyle);

  const background = pdf.createElement("div");
  background.className = "pdf-background";
  const markdown = editorRoot.cloneNode(true);

  if (!(markdown instanceof HTMLElement)) {
    throw new Error("Unable to render markdown for PDF export.");
  }

  markdown.id = "pdf-markdown";
  markdown.removeAttribute("contenteditable");

  const page = pdf.createElement("div");
  page.className = "pdf-page";
  page.append(markdown);
  pdf.body.append(background, page);

  return `<!doctype html>${pdf.documentElement.outerHTML}`;
}

/** Export current buffer edits, falling back to disk for an unopened sidebar entry. */
export function exportPdf(target: FileTarget) {
  return withMarkdownSnapshot(target, (root, title) =>
    window.lunarscribe.exportPdf(title, createPdfHtml(root, title)),
  );
}
