import type { EditorKind } from "@/lib/editor-types";

/** Default file extensions for new buffers. */
export const BUFFER_EXTENSIONS = {
  markdown: ".md",
  drawing: ".draw",
} as const satisfies Record<EditorKind, string>;

/** Text extensions accepted by the markdown editor. */
const TEXT_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

export type FileExtension = (typeof TEXT_EXTENSIONS)[number] | ".draw";

/** Slashes and null characters cannot appear in a file title. */
export const INVALID_FILE_TITLE_CHARACTERS = /[/\\\0]/gu;

/** A supported text or drawing extension, preserving its kind when a buffer is saved. */
export function getFileExtension(name: string): FileExtension | null {
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();

  if (extension === ".draw") {
    return extension;
  }

  return TEXT_EXTENSIONS.find((supported) => supported === extension) ?? null;
}

/** A file's kind, from its extension. */
export function kindOf(fileName: string): EditorKind {
  return getFileExtension(fileName) === BUFFER_EXTENSIONS.drawing
    ? "drawing"
    : "markdown";
}

/** A file's name without its extension, which is its buffer title. */
export function stemOf(fileName: string) {
  return fileName.slice(0, fileName.lastIndexOf("."));
}

/** Buffer titles are snake_case: lowercase, with whitespace and slashes turned into `_`. */
export function toBufferTitle(input: string) {
  return input
    .toLowerCase()
    .replaceAll(INVALID_FILE_TITLE_CHARACTERS, "_")
    .replaceAll(/\s/gu, "_");
}
