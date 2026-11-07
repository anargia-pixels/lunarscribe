import {
  AlignmentType,
  BorderStyle,
  CarriageReturn,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Math as WordMath,
  Paragraph,
  Tab,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import type { INumberingOptions, IRunOptions, ParagraphChild } from "docx";

import { createDocxMath } from "./docx-math";
import {
  getDocxBackgroundColor,
  getDocxColor,
  getDocxParagraphStyle,
  getDocxRunStyle,
} from "./docx-styles";

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

/** Page width inside the margins, in CSS pixels: 210mm less 2 × 18mm. */
const PAGE_CONTENT_WIDTH = ((210 - 36) / 25.4) * 96;

type DocxImage = { data: Uint8Array; width: number; height: number };

/**
 * PNG bytes for an image embed, drawn through a canvas so every format the editor shows
 * (WebP, AVIF, SVG, …) becomes one Word can open. Null when the image cannot be read,
 * such as a remote image whose server does not allow it.
 */
async function rasterizeImage(
  image: HTMLImageElement,
): Promise<DocxImage | null> {
  try {
    await image.decode();

    const canvas = document.createElement("canvas");

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );

    if (!blob || !image.naturalWidth) {
      return null;
    }

    // As shown in the editor, but no wider than 80% of the page.
    const shown = image.getBoundingClientRect().width || image.naturalWidth;
    const width = Math.min(shown, PAGE_CONTENT_WIDTH * 0.8);

    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      width,
      height: (width * image.naturalHeight) / image.naturalWidth,
    };
  } catch {
    return null;
  }
}

/** Translate the rendered editor into editable Word blocks and inline formats. */
export async function createDocxDocument(root: HTMLElement, title: string) {
  const images = new Map<HTMLImageElement, DocxImage | null>();

  for (const image of root.querySelectorAll<HTMLImageElement>(
    ".editor-image img",
  )) {
    images.set(image, await rasterizeImage(image));
  }

  const numbering: INumberingOptions["config"][number][] = [];

  const backgroundColor = getDocxColor(
    getComputedStyle(document.body).backgroundColor,
  );

  function createInlineRuns(
    node: Node,
    inherited: IRunOptions,
  ): ParagraphChild[] {
    if (node instanceof Text) {
      const children = (node.textContent ?? "")
        .replaceAll("\r\n", "\n")
        .split(/(\n|\t)/u)
        .map((text) => {
          if (text === "\n") return new CarriageReturn();

          if (text === "\t") return new Tab();

          return text;
        });

      return [new TextRun({ ...inherited, children })];
    }

    if (!(node instanceof HTMLElement) || node.matches("ul, ol")) {
      return [];
    }

    const style = getDocxRunStyle(node, inherited);

    if (node.classList.contains("editor-math")) {
      const math = node.querySelector("math");

      return math
        ? [new WordMath({ children: createDocxMath(math) })]
        : [new TextRun({ ...style, text: node.textContent ?? "" })];
    }

    if (node.tagName === "BR") {
      return [new TextRun({ ...style, break: 1 })];
    }

    const children = Array.from(node.childNodes).flatMap((child) =>
      createInlineRuns(child, style),
    );

    if (node instanceof HTMLAnchorElement) {
      return [new ExternalHyperlink({ link: node.href, children })];
    }

    return children;
  }

  function createParagraph(element: HTMLElement) {
    const style = getDocxParagraphStyle(element);
    const runStyle = getDocxRunStyle(element);

    const isEmpty =
      !element.textContent &&
      element.children.length === 1 &&
      element.firstElementChild?.tagName === "BR";

    return new Paragraph({
      ...style,
      heading: /^H[1-6]$/u.test(element.tagName)
        ? HEADINGS[Number(element.tagName.slice(1)) - 1]
        : undefined,
      alignment: element.classList.contains("editor-math-block")
        ? AlignmentType.CENTER
        : style.alignment,
      run: runStyle,
      children: isEmpty ? [] : createInlineRuns(element, runStyle),
    });
  }

  function createList(element: HTMLElement, depth: number): Paragraph[] {
    const level = Math.min(depth, 8);
    const reference = `list-${numbering.length}`;
    const isOrdered = element.tagName === "OL";

    numbering.push({
      reference,
      levels: Array.from({ length: 9 }, (_, index) => ({
        level: index,
        format: isOrdered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
        text: isOrdered ? `%${index + 1}.` : "•",
        start: element instanceof HTMLOListElement ? element.start : 1,
        style: {
          run: getDocxRunStyle(root),
          paragraph: { indent: { left: (index + 1) * 360, hanging: 360 } },
        },
      })),
    });

    const paragraphs: Paragraph[] = [];

    for (const child of element.children) {
      if (!(child instanceof HTMLElement)) continue;

      const isCheckbox = child.getAttribute("role") === "checkbox";
      const runStyle = getDocxRunStyle(child);
      const children = createInlineRuns(child, runStyle);

      if (isCheckbox) {
        children.unshift(
          new TextRun({
            ...runStyle,
            text: child.getAttribute("aria-checked") === "true" ? "☑ " : "☐ ",
          }),
        );
      }

      // Omit Lexical's nested-list wrappers, but retain actual empty list items.
      if (children.length || !child.querySelector(":scope > ul, :scope > ol")) {
        paragraphs.push(
          new Paragraph({
            ...getDocxParagraphStyle(child),
            children,
            run: runStyle,
            numbering: isCheckbox ? false : { reference, level },
            indent: isCheckbox
              ? { left: (level + 1) * 360, hanging: 360 }
              : undefined,
          }),
        );
      }

      for (const nested of child.children) {
        if (nested instanceof HTMLElement && nested.matches("ul, ol")) {
          paragraphs.push(...createList(nested, depth + 1));
        }
      }
    }

    return paragraphs;
  }

  function createTable(element: HTMLTableElement) {
    const rows = Array.from(
      element.rows,
      (row) =>
        new TableRow({
          cantSplit: true,
          tableHeader: Array.from(row.cells).every(
            (cell) => cell.tagName === "TH",
          ),
          children: Array.from(row.cells, (cell) => {
            const children = createBlocks(cell);
            const cellBackgroundColor = getDocxBackgroundColor(cell);

            if (!(children.at(-1) instanceof Paragraph))
              children.push(new Paragraph(""));

            return new TableCell({
              children,
              columnSpan: cell.colSpan,
              rowSpan: cell.rowSpan,
              shading: {
                fill: cellBackgroundColor
                  ? getDocxColor(cellBackgroundColor)
                  : backgroundColor,
              },
              margins: { top: 120, bottom: 120, left: 180, right: 180 },
            });
          }),
        }),
    );

    const border = {
      style: BorderStyle.SINGLE,
      size: 6,
      color: getDocxColor(getComputedStyle(element).borderTopColor),
    };

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: border,
        bottom: border,
        left: border,
        right: border,
        insideHorizontal: border,
        insideVertical: border,
      },
    });
  }

  /** An embedded image, or its alt text and error message when it cannot be read. */
  function createImage(element: HTMLElement) {
    const image = element.querySelector("img");
    const prepared = image ? images.get(image) : null;

    if (image && prepared) {
      return new Paragraph({
        children: [
          new ImageRun({
            type: "png",
            data: prepared.data,
            transformation: {
              width: prepared.width,
              height: prepared.height,
            },
            altText: { name: image.alt, description: image.alt },
          }),
        ],
      });
    }

    const text =
      element
        .querySelector("[data-image-error]")
        ?.getAttribute("data-image-error") ?? `Image: ${image?.alt ?? ""}`;

    return new Paragraph({
      children: [
        new TextRun({
          ...getDocxRunStyle(element),
          italics: true,
          text: `[${text}]`,
        }),
      ],
    });
  }

  function createBlocks(container: HTMLElement): (Paragraph | Table)[] {
    return Array.from(container.childNodes).flatMap((node) => {
      if (node instanceof Text) {
        return node.textContent?.trim()
          ? [
              new Paragraph({
                children: createInlineRuns(node, getDocxRunStyle(container)),
              }),
            ]
          : [];
      }

      if (!(node instanceof HTMLElement)) return [];

      if (node.matches("ul, ol")) return createList(node, 0);

      if (node instanceof HTMLTableElement) return [createTable(node)];

      if (node.classList.contains("editor-image")) return [createImage(node)];

      if (node.tagName === "DIV" && !node.classList.contains("editor-math"))
        return createBlocks(node);

      if (node.tagName === "HR") {
        return [
          new Paragraph({
            ...getDocxParagraphStyle(node),
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: getDocxColor(getComputedStyle(node).borderTopColor),
              },
            },
          }),
        ];
      }

      return [createParagraph(node)];
    });
  }

  const children = createBlocks(root);

  return new Document({
    title,
    creator: "Lunarscribe",
    background: {
      color: backgroundColor,
    },
    styles: {
      default: {
        document: {
          run: getDocxRunStyle(root),
          paragraph: { keepLines: true },
        },
      },
    },
    numbering: { config: numbering },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(16),
              bottom: convertMillimetersToTwip(16),
              left: convertMillimetersToTwip(18),
              right: convertMillimetersToTwip(18),
            },
          },
        },
        children: children.length ? children : [new Paragraph("")],
      },
    ],
  });
}
