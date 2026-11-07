import { baseNameOf, folderOf, joinSavedPath } from "./saved-paths";

/**
 * Image embeds follow Obsidian: `![[photo.png]]` or `![alt](photo.png)` point at an image
 * file next to the markdown file, and `![alt](https://…)` at a remote image. A dropped
 * image is copied next to the markdown file that embeds it.
 */

/** Image formats the markdown editor embeds, by extension, with their MIME types. */
const IMAGE_TYPES = new Map([
  [".apng", "image/apng"],
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

/** Image extensions without their dots: `png`, `jpg`, … */
export const IMAGE_EXTENSIONS = [...IMAGE_TYPES.keys()].map((extension) =>
  extension.slice(1),
);

/** The lowercase extension of `name`, with its dot, or `""`. */
function extensionOf(name: string) {
  const base = baseNameOf(name);
  const dot = base.lastIndexOf(".");

  return dot === -1 ? "" : base.slice(dot).toLowerCase();
}

/** Whether `name` has the extension of an image format the editor embeds. */
export function isImageFileName(name: string) {
  return IMAGE_TYPES.has(extensionOf(name));
}

/** The MIME type of an image file, from its extension. */
export function imageMimeType(name: string) {
  return IMAGE_TYPES.get(extensionOf(name)) ?? "application/octet-stream";
}

/** Image extensions as a readable list, for error messages. */
export const IMAGE_FORMAT_NAMES =
  "PNG, JPEG, GIF, WebP, AVIF, SVG, BMP, or ICO";

/** The extension for an image MIME type, for clipboard images without a usable name. */
function extensionForMimeType(type: string) {
  const match = [...IMAGE_TYPES].find(
    ([, mime]) => mime === type.toLowerCase(),
  );

  return match?.[0] ?? null;
}

/**
 * A safe file name for an image dropped or pasted into a buffer: no folders, no leading
 * dot (hidden files are never listed or synced), and an image extension. Returns null
 * when the file is not an image the editor embeds.
 */
export function toImageFileName(name: string, type: string) {
  let base = baseNameOf(name.replaceAll("\\", "/"))
    .replaceAll(/\p{Cc}/gu, "")
    .replaceAll(/[[\]|#^]/gu, "_")
    .trim();

  if (!isImageFileName(base)) {
    const extension = extensionForMimeType(type);

    if (!extension) {
      return null;
    }

    base = `${base.replace(/\.[^.]*$/u, "") || "image"}${extension}`;
  }

  return base.startsWith(".") ? `image${base}` : base;
}

/** `<stem><extension>` split for collision suffixes: `photo.png` → `photo`, `.png`. */
export function splitImageFileName(name: string) {
  const dot = name.lastIndexOf(".");

  return { stem: name.slice(0, dot), extension: name.slice(dot) };
}

/** A pasted image's name, as Obsidian names them: `Pasted image 20261107153045.png`. */
export function pastedImageFileName(type: string, date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");

  return `Pasted image ${stamp}${extensionForMimeType(type) ?? ".png"}`;
}

/** Whether an embed target is a URL (`https://…`, `data:…`) rather than a file path. */
export function isUrlTarget(target: string) {
  return /^[a-z][a-z\d+.-]*:/iu.test(target);
}

/**
 * `relative` resolved from `folder` (`""` is the top level) as a saved path, with `.` and
 * `..` applied and `%20`-style escapes decoded. Null when it leaves the top level, names a
 * hidden entry, or is not a relative path.
 */
export function resolveRelativeImagePath(folder: string, relative: string) {
  let decoded: string;

  try {
    decoded = decodeURI(relative);
  } catch {
    decoded = relative;
  }

  if (!decoded || decoded.startsWith("/") || /[\\\0]/u.test(decoded)) {
    return null;
  }

  const parts = folder ? folder.split("/") : [];

  for (const part of decoded.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }

    if (part === ".." && parts.length > 0) {
      parts.pop();

      continue;
    }

    // Leaving the top level, or naming a hidden entry.
    if (part.startsWith(".")) {
      return null;
    }

    parts.push(part);
  }

  return parts.length ? parts.join("/") : null;
}

/**
 * The saved image an embed in the markdown file `noteName` points at, the way Obsidian
 * resolves it: a path relative to the note's folder, then a path from the top level, then,
 * for a bare file name, the closest image with that name anywhere in the saved files.
 * `imageNames` lists every saved image path; null when nothing matches.
 */
export function resolveSavedImage(
  noteFolder: string,
  target: string,
  imageNames: readonly string[],
) {
  const names = new Set(imageNames);

  for (const candidate of [
    resolveRelativeImagePath(noteFolder, target),
    resolveRelativeImagePath("", target),
  ]) {
    if (candidate && names.has(candidate)) {
      return candidate;
    }
  }

  const relative = resolveRelativeImagePath("", target);

  if (!relative || relative.includes("/")) {
    return null;
  }

  // The match sharing the longest folder prefix with the note wins, then the shallowest.
  const sharedDepth = (path: string) => {
    const from = noteFolder ? noteFolder.split("/") : [];
    const to = folderOf(path) ? folderOf(path).split("/") : [];
    let depth = 0;

    while (depth < from.length && from[depth] === to[depth]) {
      depth += 1;
    }

    return depth;
  };

  const matches = imageNames
    .filter((name) => baseNameOf(name).toLowerCase() === relative.toLowerCase())
    .sort(
      (first, second) =>
        sharedDepth(second) - sharedDepth(first) ||
        first.split("/").length - second.split("/").length ||
        first.localeCompare(second),
    );

  return matches[0] ?? null;
}

/** `name` in `folder`, or `<stem>_1<extension>`, ... when `exists` reports it taken. */
export function availableImageName(
  folder: string,
  name: string,
  exists: (path: string) => boolean,
) {
  const { stem, extension } = splitImageFileName(name);
  let path = joinSavedPath(folder, name);

  for (let suffix = 1; exists(path); suffix += 1) {
    path = joinSavedPath(folder, `${stem}_${suffix}${extension}`);
  }

  return path;
}

/** The path from `folder` to the saved path `path`, using `..` to climb out of folders. */
function relativeImagePath(folder: string, path: string) {
  const from = folder ? folder.split("/") : [];
  const to = path.split("/");
  let shared = 0;

  while (
    shared < from.length &&
    shared < to.length - 1 &&
    from[shared] === to[shared]
  ) {
    shared += 1;
  }

  return [
    ...Array.from({ length: from.length - shared }, () => ".."),
    ...to.slice(shared),
  ].join("/");
}

const WIKILINK_EMBED = /!\[\[([^[\]\n]+)\]\]/gu;

const MARKDOWN_EMBED = /(!\[[^[\]\n]*\]\(\s*)(<[^<>\n]+>|[^\s<>()]+)/gu;

/**
 * `markdown` with its embeds of the saved image `from` pointed at `to`, after the image
 * was renamed or moved, as Obsidian updates links. `noteName` is the markdown file's saved
 * path; `imagesBefore` and `imagesAfter` list every saved image path around the change.
 * Wikilinks keep the bare file name while no other image shares it; markdown embeds get
 * the path from the note's folder.
 */
export function rewriteImageEmbeds(
  markdown: string,
  noteName: string,
  from: string,
  to: string,
  imagesBefore: readonly string[],
  imagesAfter: readonly string[],
) {
  const noteFolder = folderOf(noteName);

  const pointsAtImage = (target: string) =>
    !isUrlTarget(target) &&
    resolveSavedImage(noteFolder, target.trim(), imagesBefore) === from;

  const isNameUnique =
    imagesAfter.filter(
      (name) => baseNameOf(name).toLowerCase() === baseNameOf(to).toLowerCase(),
    ).length === 1;

  return markdown
    .replaceAll(WIKILINK_EMBED, (embed, inner: string) => {
      const bar = inner.indexOf("|");
      const target = bar === -1 ? inner : inner.slice(0, bar);
      const rest = bar === -1 ? "" : inner.slice(bar);

      if (!pointsAtImage(target)) {
        return embed;
      }

      const next = !target.includes("/") && isNameUnique ? baseNameOf(to) : to;

      return `![[${next}${rest}]]`;
    })
    .replaceAll(
      MARKDOWN_EMBED,
      (embed, opening: string, destination: string) => {
        const isAngled = destination.startsWith("<");
        const target = isAngled ? destination.slice(1, -1) : destination;

        if (!pointsAtImage(target)) {
          return embed;
        }

        const path = relativeImagePath(noteFolder, to);

        return `${opening}${isAngled ? `<${path}>` : path.replaceAll(" ", "%20")}`;
      },
    );
}
