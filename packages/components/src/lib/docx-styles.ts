import { AlignmentType, BorderStyle, LineRuleType } from "docx";
import type { IParagraphOptions, IRunOptions } from "docx";

const colors = new Map<string, string>();

const canvas = document.createElement("canvas");

canvas.width = 1;

canvas.height = 1;

/** Word needs RGB hex; canvas also resolves theme colors expressed as OKLCH. */
export function getDocxColor(cssColor: string) {
  const cached = colors.get(cssColor);

  if (cached) {
    return cached;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to read theme colors for DOCX export.");
  }

  context.clearRect(0, 0, 1, 1);
  context.fillStyle = cssColor;
  context.fillRect(0, 0, 1, 1);

  const channels = context.getImageData(0, 0, 1, 1).data;

  const hex = Array.from(channels.slice(0, 3), (channel) =>
    channel.toString(16).padStart(2, "0"),
  ).join("");

  colors.set(cssColor, hex);

  return hex;
}

/** Selection highlights are editor controls, so retain the cell's underlying color. */
export function getDocxBackgroundColor(element: HTMLElement) {
  const style = getComputedStyle(element);

  if (element.matches("td.bg-accent, th.bg-accent")) {
    return element.classList.contains("bg-popover")
      ? style.getPropertyValue("--popover").trim()
      : undefined;
  }

  const color = style.backgroundColor;

  return color !== "transparent" && color !== "rgba(0, 0, 0, 0)"
    ? color
    : undefined;
}

function getAlignment(style: CSSStyleDeclaration) {
  switch (style.textAlign) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "left":
      return AlignmentType.LEFT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    case "end":
      return AlignmentType.END;
    default:
      return AlignmentType.START;
  }
}

export function getDocxRunStyle(
  element: HTMLElement,
  inherited: IRunOptions = {},
): IRunOptions {
  const style = getComputedStyle(element);

  const decoration = style.textDecorationLine;
  const backgroundColor = getDocxBackgroundColor(element);

  return {
    font: style.fontFamily
      .split(",")[0]
      ?.trim()
      .replaceAll(/^['"]|['"]$/gu, ""),
    size: Math.round(Number.parseFloat(style.fontSize) * 1.5),
    color: getDocxColor(style.color),
    bold: Number.parseInt(style.fontWeight, 10) >= 600,
    italics: style.fontStyle === "italic",
    strike: inherited.strike || decoration.includes("line-through"),
    underline: decoration.includes("underline") ? {} : inherited.underline,
    subScript: inherited.subScript || element.tagName === "SUB",
    superScript: inherited.superScript || element.tagName === "SUP",
    shading: backgroundColor
      ? { fill: getDocxColor(backgroundColor) }
      : inherited.shading,
  };
}

export function getDocxParagraphStyle(element: HTMLElement): IParagraphOptions {
  const style = getComputedStyle(element);
  const isHeading = /^H[1-6]$/u.test(element.tagName);
  const leftBorderPx = Number.parseFloat(style.borderLeftWidth);
  const lineHeightPx = Number.parseFloat(style.lineHeight);
  const backgroundColor = getDocxBackgroundColor(element);

  return {
    alignment: getAlignment(style),
    bidirectional: style.direction === "rtl",
    keepLines: true,
    keepNext: isHeading,
    widowControl: true,
    spacing: {
      before: Math.round(Number.parseFloat(style.marginTop) * 15),
      after: Math.round(Number.parseFloat(style.marginBottom) * 15),
      line: Number.isFinite(lineHeightPx)
        ? Math.round(lineHeightPx * 15)
        : undefined,
      lineRule: LineRuleType.AT_LEAST,
    },
    indent: { left: Math.round(Number.parseFloat(style.paddingLeft) * 15) },
    shading: backgroundColor
      ? { fill: getDocxColor(backgroundColor) }
      : undefined,
    border:
      leftBorderPx > 0
        ? {
            left: {
              style: BorderStyle.SINGLE,
              size: Math.round(leftBorderPx * 6),
              color: getDocxColor(style.borderLeftColor),
            },
          }
        : undefined,
  };
}
