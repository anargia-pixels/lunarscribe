/** An image embed as written in markdown, in Obsidian's two syntaxes. */
export type ImageEmbed = {
  /** The file path or URL, as written (`photo.png`, `assets/a%20b.png`, `https://…`). */
  target: string;
  alt: string;
  /** Display width in CSS pixels; the height always follows the aspect ratio. */
  width: number | null;
  /** Kept only so `|300x200` sizes survive a round trip. */
  height: number | null;
  /** `![[photo.png]]` or `![alt](photo.png)`. */
  syntax: "wikilink" | "markdown";
  /** The optional `"title"` after a markdown destination, kept for round trips. */
  title: string | null;
};

const SIZE = /^\s*(\d{1,5})(?:\s*x\s*(\d{1,5}))?\s*$/u;

/** `300` or `300x200` from an embed's last `|` part, or null. */
function parseSize(text: string) {
  const match = SIZE.exec(text);

  return match
    ? {
        width: Number(match[1]),
        height: match[2] === undefined ? null : Number(match[2]),
      }
    : null;
}

function formatSize({ width, height }: ImageEmbed) {
  if (width === null) {
    return "";
  }

  return height === null ? `${width}` : `${width}x${height}`;
}

/** A whole line holding `![[target|alt|300]]`. */
export const WIKILINK_IMAGE_LINE = /^ {0,3}!\[\[([^[\]\n]+)\]\][ \t]*$/u;

/** A whole line holding `![alt|300](target "title")`, with an optional `<…>` destination. */
export const MARKDOWN_IMAGE_LINE =
  /^ {0,3}!\[([^[\]\n]*)\]\(\s*(?:<([^<>\n]+)>|([^\s<>]+?))(?:\s+"([^"\n]*)")?\s*\)[ \t]*$/u;

export function parseWikilinkImage(inner: string): ImageEmbed | null {
  const [rawTarget = "", ...parts] = inner.split("|");
  const target = rawTarget.trim();

  if (!target) {
    return null;
  }

  const size = parts.length ? parseSize(parts.at(-1)!) : null;
  const altParts = size ? parts.slice(0, -1) : parts;

  return {
    target,
    alt: altParts.join("|").trim(),
    width: size?.width ?? null,
    height: size?.height ?? null,
    syntax: "wikilink",
    title: null,
  };
}

export function parseMarkdownImage(
  rawAlt: string,
  target: string,
  title: string | undefined,
): ImageEmbed {
  const bar = rawAlt.lastIndexOf("|");
  const size = bar === -1 ? null : parseSize(rawAlt.slice(bar + 1));

  return {
    target,
    alt: (size ? rawAlt.slice(0, bar) : rawAlt).trim(),
    width: size?.width ?? null,
    height: size?.height ?? null,
    syntax: "markdown",
    title: title ?? null,
  };
}

/** The embed parsed from a line of markdown, or null when the line is not one image. */
export function parseImageLine(line: string): ImageEmbed | null {
  const wikilink = WIKILINK_IMAGE_LINE.exec(line);

  if (wikilink) {
    return parseWikilinkImage(wikilink[1]!);
  }

  const markdown = MARKDOWN_IMAGE_LINE.exec(line);

  return markdown
    ? parseMarkdownImage(markdown[1]!, markdown[2] ?? markdown[3]!, markdown[4])
    : null;
}

/** The embed written back in the syntax it was read in. */
export function formatImageEmbed(embed: ImageEmbed) {
  const size = formatSize(embed);

  if (embed.syntax === "wikilink") {
    const parts = [embed.target, embed.alt, size].filter(Boolean);

    return `![[${parts.join("|")}]]`;
  }

  const alt = [embed.alt, size].filter(Boolean).join("|");

  const destination = /[\s()]/u.test(embed.target)
    ? `<${embed.target}>`
    : embed.target;

  const title = embed.title === null ? "" : ` "${embed.title}"`;

  return `![${alt}](${destination}${title})`;
}
