/**
 * Color math for imported color themes: parses the formats theme files use,
 * blends translucent colors onto their surface, and checks contrast. Imported
 * palettes are stored as hex so every color reads the same way afterwards.
 */

import { type JsonValue, jsonText } from "./theme-json";

// Types

/** sRGB channels from 0 to 255, alpha from 0 to 1. */
export type Rgba = { r: number; g: number; b: number; a: number };

// Parsing

const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function parseHex(value: string): Rgba | null {
  const hex = HEX.exec(value)?.[1];

  if (hex === undefined) {
    return null;
  }

  // Short forms repeat each digit: #abc is #aabbcc.
  const full =
    hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;

  const channel = (index: number) =>
    Number.parseInt(full.slice(index * 2, index * 2 + 2), 16);

  return {
    r: channel(0),
    g: channel(1),
    b: channel(2),
    a: full.length === 8 ? channel(3) / 255 : 1,
  };
}

/** A CSS number, or a percentage scaled to `percentOf`. */
function parseNumber(part: string, percentOf: number): number {
  return part.endsWith("%")
    ? (Number.parseFloat(part) / 100) * percentOf
    : Number.parseFloat(part);
}

type FunctionParts = {
  channels: [string, string, string];
  alpha: number;
};

/** Splits `rgb(1 2 3 / 50%)` or `rgb(1, 2, 3, 0.5)` into its channels and alpha. */
function functionParts(value: string, name: string): FunctionParts | null {
  const body = new RegExp(`^${name}a?\\(([^)]*)\\)$`, "i").exec(value)?.[1];

  if (body === undefined) {
    return null;
  }

  const [channelPart = "", slashAlpha] = body.split("/");

  const [first, second, third, commaAlpha] = channelPart
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);

  const alphaPart = slashAlpha?.trim() ?? commaAlpha;
  const alpha = alphaPart === undefined ? 1 : parseNumber(alphaPart, 1);

  if (
    first === undefined ||
    second === undefined ||
    third === undefined ||
    !Number.isFinite(alpha)
  ) {
    return null;
  }

  return { channels: [first, second, third], alpha };
}

function encodeGamma(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));

  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

/** OKLCH to sRGB through OKLab; colors outside sRGB are clipped. */
function parseOklch(value: string): Rgba | null {
  const parts = functionParts(value, "oklch");

  if (!parts) {
    return null;
  }

  const [lightnessPart, chromaPart, huePart] = parts.channels;
  const lightness = parseNumber(lightnessPart, 1);
  const chroma = parseNumber(chromaPart, 0.4);
  const hue = (Number.parseFloat(huePart) * Math.PI) / 180;

  if (![lightness, chroma, hue].every(Number.isFinite)) {
    return null;
  }

  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r:
      encodeGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255,
    g:
      encodeGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) *
      255,
    b:
      encodeGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255,
    a: Math.min(1, Math.max(0, parts.alpha)),
  };
}

function parseRgb(value: string): Rgba | null {
  const parts = functionParts(value, "rgb");

  if (!parts) {
    return null;
  }

  const [red, green, blue] = parts.channels;
  const r = parseNumber(red, 255);
  const g = parseNumber(green, 255);
  const b = parseNumber(blue, 255);

  if (![r, g, b].every(Number.isFinite)) {
    return null;
  }

  return { r, g, b, a: Math.min(1, Math.max(0, parts.alpha)) };
}

/** Reads a hex, `rgb()` or `oklch()` color; anything else is null. */
export function parseColor(value: JsonValue | undefined): Rgba | null {
  const text = jsonText(value);

  if (text === null) {
    return null;
  }

  const trimmed = text.trim();

  return parseHex(trimmed) ?? parseRgb(trimmed) ?? parseOklch(trimmed);
}

// Output

/** The opaque hex of a color; alpha is dropped, so flatten it first. */
export function toHex({ r, g, b }: Rgba): string {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0");

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// Blending

/** Paints a translucent color onto an opaque surface, as the screen would show it. */
export function flattenOver(color: Rgba, surface: Rgba): Rgba {
  const blend = (top: number, bottom: number) =>
    top * color.a + bottom * (1 - color.a);

  return {
    r: blend(color.r, surface.r),
    g: blend(color.g, surface.g),
    b: blend(color.b, surface.b),
    a: 1,
  };
}

/** `amount` of `top` over `bottom`, from 0 (all bottom) to 1 (all top). */
export function mix(bottom: Rgba, top: Rgba, amount: number): Rgba {
  return flattenOver({ ...top, a: amount }, bottom);
}

// Contrast

function relativeLuminance({ r, g, b }: Rgba): number {
  const channel = (value: number) => {
    const ratio = value / 255;

    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(first: Rgba, second: Rgba): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Whether white text reads better on this color than black text. */
export function isDarkColor(color: Rgba): boolean {
  return relativeLuminance(color) < 0.179;
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

/** The first candidate that reaches `minContrast` on the surface, else black or white. */
export function readableOn(
  surface: Rgba,
  candidates: ReadonlyArray<Rgba | null>,
  minContrast = 4.5,
): Rgba {
  for (const candidate of candidates) {
    if (candidate && contrastRatio(candidate, surface) >= minContrast) {
      return candidate;
    }
  }

  return isDarkColor(surface) ? WHITE : BLACK;
}
