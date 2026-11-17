/**
 * Readers for theme files and theme APIs. Theme JSON comes from the network or
 * the user, so every field is checked before a converter relies on it.
 */

import type { JsonValue } from "@lunarscribe/utils/sync/json";
import { parse, type ParseError } from "jsonc-parser";

export type { JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/** Parses JSON with comments and trailing commas, as VS Code theme files allow. */
export function parseThemeJson(text: string): JsonValue {
  const errors: ParseError[] = [];
  const value: JsonValue = parse(text, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    throw new Error("That file is not valid JSON.");
  }

  return value;
}

/** The value as an object, or null for arrays, primitives and missing values. */
export function jsonObject(value: JsonValue | undefined): JsonObject | null {
  if (value === undefined || value === null || Array.isArray(value)) {
    return null;
  }

  if (Object(value) !== value) {
    return null;
  }

  // SAFETY: Parsed JSON that is an object and not an array is a key-value record.
  return value as JsonObject;
}

export function jsonText(value: JsonValue | undefined): string | null {
  return value !== undefined && value === String(value) ? String(value) : null;
}

export function jsonList(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

/** Fetches JSON, refusing responses larger than `maxBytes`. */
export async function fetchJson(
  url: string,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<JsonValue> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`The request failed (${response.status}).`);
  }

  const text = await response.text();

  if (text.length > maxBytes) {
    throw new Error("The response was too large.");
  }

  return parseThemeJson(text);
}
