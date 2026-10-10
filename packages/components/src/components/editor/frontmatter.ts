/** A frontmatter value the frontmatter panel can edit. */
export type FrontmatterValue = string | number | boolean | string[] | null;

/** One frontmatter entry: an editable property or raw YAML text kept as written. */
export type FrontmatterEntry =
  | { kind: "property"; key: string; value: FrontmatterValue }
  | { kind: "raw"; text: string };

/** A buffer's markdown split into frontmatter entries and the markdown body. */
export type ParsedFrontmatter = {
  entries: FrontmatterEntry[];
  body: string;
};

/** A decoded YAML scalar or flow list, or content the model cannot represent. */
type DecodedValue =
  | { kind: "value"; value: FrontmatterValue }
  | { kind: "unsupported" };

const FENCE = "---";

const KEY_PATTERN = /^([A-Za-z0-9_.\- ]+?):(?:\s(.*))?$/;

const LIST_ITEM_PATTERN = /^\s*-(?:\s(.*))?$/;

const INDENTED_PATTERN = /^[ \t]/;

const INTEGER_PATTERN = /^-?(0|[1-9]\d*)$/;

const DECIMAL_PATTERN = /^-?(0|[1-9]\d*)\.\d+$/;

const PLAIN_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_ ./?&-]*$/;

const TYPED_PATTERN = /^(?:null|true|false|~)$/;

/**
 * Splits a buffer's markdown into frontmatter entries and the markdown body.
 * Markdown without a leading `---` fence pair parses to no entries and the
 * original markdown as the body.
 */
export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const fences = splitFences(markdown);

  if (fences === null) {
    return { entries: [], body: markdown };
  }

  return { entries: decodeEntries(fences.yaml), body: fences.body };
}

/**
 * Serializes frontmatter entries back to a `---` fenced block for the top of a
 * buffer's markdown. Entries without a key are dropped, so a row the user never
 * named does not reach the file. Raw entries are emitted verbatim.
 */
export function stringifyFrontmatter(entries: FrontmatterEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    const line = serializeEntry(entry);

    if (line !== null) {
      lines.push(line);
    }
  }

  if (lines.length === 0) {
    return "";
  }

  return `${FENCE}\n${lines.join("\n")}\n${FENCE}\n`;
}

function splitFences(markdown: string): { yaml: string; body: string } | null {
  if (markdown !== FENCE && !markdown.startsWith(`${FENCE}\n`)) {
    return null;
  }

  const lines = markdown.split("\n");

  const close = lines.findIndex(
    (line, index) => index > 0 && line.trimEnd() === FENCE,
  );

  if (close < 0) {
    return null;
  }

  return {
    yaml: lines.slice(1, close).join("\n"),
    body: lines.slice(close + 1).join("\n"),
  };
}

function decodeEntries(yaml: string): FrontmatterEntry[] {
  const lines = yaml.split("\n");
  const entries: FrontmatterEntry[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const match = KEY_PATTERN.exec(line);

    if (match === null) {
      entries.push({ kind: "raw", text: line.trimEnd() });
      index += 1;
      continue;
    }

    const key = match[1] ?? "";
    const inline = match[2];
    const blockEnd = collectBlock(lines, index + 1);
    const block = lines.slice(index + 1, blockEnd);

    if (inline === undefined) {
      const list = decodeBlockList(block);

      if (list === null && block.length > 0) {
        entries.push(rawBlock(line, block));
      } else {
        entries.push({ kind: "property", key, value: list });
      }
    } else if (block.length > 0) {
      // A key cannot hold both an inline value and a block, so keep the lines.
      entries.push(rawBlock(line, block));
    } else {
      const decoded = decodeScalar(stripComment(inline.trim()));

      if (decoded.kind === "value") {
        entries.push({ kind: "property", key, value: decoded.value });
      } else {
        entries.push({ kind: "raw", text: line.trimEnd() });
      }
    }

    index = blockEnd;
  }

  return entries;
}

/** Keeps a key and the lines under it as written, such as a nested mapping. */
function rawBlock(line: string, block: readonly string[]): FrontmatterEntry {
  return { kind: "raw", text: [line, ...block].join("\n") };
}

/** Returns the exclusive end of the indented block or block list under a key. */
function collectBlock(lines: readonly string[], start: number): number {
  let end = start;

  while (end < lines.length) {
    const line = lines[end] ?? "";

    const belongs =
      INDENTED_PATTERN.test(line) ||
      (line.trim() !== "" && LIST_ITEM_PATTERN.test(line));

    if (!belongs) {
      break;
    }

    end += 1;
  }

  return end;
}

function decodeBlockList(block: readonly string[]): string[] | null {
  if (block.length === 0) {
    return null;
  }

  const items: string[] = [];

  for (const line of block) {
    const match = LIST_ITEM_PATTERN.exec(line);

    if (match === null) {
      return null;
    }

    items.push(unquote((match[1] ?? "").trim()));
  }

  return items;
}

function decodeScalar(text: string): DecodedValue {
  if (text === "" || text === "null" || text === "~") {
    return { kind: "value", value: null };
  }

  if (text === "true") {
    return { kind: "value", value: true };
  }

  if (text === "false") {
    return { kind: "value", value: false };
  }

  if (INTEGER_PATTERN.test(text)) {
    const parsed = Number(text);

    return {
      kind: "value",
      value: Number.isSafeInteger(parsed) ? parsed : text,
    };
  }

  if (DECIMAL_PATTERN.test(text)) {
    return { kind: "value", value: Number(text) };
  }

  if (text.startsWith("[") && text.endsWith("]")) {
    return decodeFlowList(text);
  }

  return { kind: "value", value: unquote(text) };
}

function decodeFlowList(text: string): DecodedValue {
  const inner = text.slice(1, -1).trim();

  if (inner === "") {
    return { kind: "value", value: [] };
  }

  const items: string[] = [];

  for (const rawItem of splitFlowItems(inner)) {
    const decoded = decodeScalar(rawItem.trim());

    if (decoded.kind === "unsupported" || Array.isArray(decoded.value)) {
      return { kind: "unsupported" };
    }

    items.push(displayValue(decoded.value));
  }

  return { kind: "value", value: items };
}

/** Splits flow-list content on commas that are outside quotes and brackets. */
function splitFlowItems(text: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote: string | null = null;
  let depth = 0;

  for (const char of text) {
    if (quote !== null) {
      current += char;

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      items.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  items.push(current);

  return items;
}

function stripComment(text: string): string {
  let quote: string | null = null;

  const chars = [...text];

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? "";

    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    const previous = chars[index - 1];

    if (char === "#" && previous === " ") {
      return text.slice(0, index).trimEnd();
    }
  }

  return text.trimEnd();
}

function unquote(text: string): string {
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return unescapeDoubleQuoted(text.slice(1, -1));
  }

  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }

  return text;
}

/** Resolves the backslash escapes a double-quoted YAML scalar can hold. */
function unescapeDoubleQuoted(text: string): string {
  let result = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char !== "\\") {
      result += char;
      index += 1;
      continue;
    }

    const escaped = text[index + 1];

    if (escaped === "n") {
      result += "\n";
    } else if (escaped === "t") {
      result += "\t";
    } else if (escaped === "r") {
      result += "\r";
    } else if (escaped !== undefined) {
      result += escaped;
    } else {
      result += char;
    }

    index += 2;
  }

  return result;
}

function serializeEntry(entry: FrontmatterEntry): string | null {
  if (entry.kind === "raw") {
    return entry.text === "" ? null : entry.text;
  }

  if (entry.key === "") {
    return null;
  }

  if (isListValue(entry.value)) {
    const items = entry.value.map(serializeString);

    return `${entry.key}: [${items.join(", ")}]`;
  }

  if (entry.value === null || entry.value === "") {
    return `${entry.key}:`;
  }

  if (isTextValue(entry.value) && entry.value.includes("\n")) {
    const body = entry.value
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");

    return `${entry.key}: |\n${body}`;
  }

  return `${entry.key}: ${serializeScalar(entry.value)}`;
}

function serializeScalar(value: FrontmatterValue): string {
  if (isCheckboxValue(value)) {
    return value ? "true" : "false";
  }

  if (isNumberValue(value)) {
    return String(value);
  }

  if (isTextValue(value)) {
    return serializeString(value);
  }

  return "null";
}

function serializeString(value: string): string {
  const plain =
    PLAIN_PATTERN.test(value) &&
    !TYPED_PATTERN.test(value) &&
    !INTEGER_PATTERN.test(value) &&
    !DECIMAL_PATTERN.test(value);

  return plain ? value : JSON.stringify(value);
}

function displayValue(value: FrontmatterValue): string {
  if (isListValue(value)) {
    return value.join(", ");
  }

  if (isCheckboxValue(value)) {
    return value ? "true" : "false";
  }

  if (isTextValue(value)) {
    return value;
  }

  return "";
}

/** Narrows a value to a list of text, the shape the panel edits as chips. */
export function isListValue(value: FrontmatterValue): value is string[] {
  return Array.isArray(value);
}

/** Narrows a value to a number, which the panel edits in a number field. */
export function isNumberValue(value: FrontmatterValue): value is number {
  return Number.isFinite(value);
}

/** Narrows a value to a checkbox, the only boolean shape YAML frontmatter has. */
export function isCheckboxValue(value: FrontmatterValue): value is boolean {
  return value === true || value === false;
}

/** Narrows a value to text, the fallback shape for every other value. */
export function isTextValue(value: FrontmatterValue): value is string {
  return (
    !isListValue(value) &&
    !isNumberValue(value) &&
    !isCheckboxValue(value) &&
    value !== null
  );
}
