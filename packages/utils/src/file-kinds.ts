import { isImageFileName } from "./images";
import {
  baseNameOf,
  INVALID_NAME_CHARACTERS,
  isSafeSavedPath,
} from "./saved-paths";

// File kinds
/** Text extensions accepted by the markdown editor. */
const TEXT_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

export type FileExtension = (typeof TEXT_EXTENSIONS)[number] | ".draw";

/** Kinds of buffer the editor can show. */
export type EditorKind = "markdown" | "drawing";

/** Default file extensions for new buffers. */
export const BUFFER_EXTENSIONS = {
  markdown: ".md",
  drawing: ".draw",
} as const satisfies Record<EditorKind, FileExtension>;

/** A supported text or drawing extension, preserving its kind when a buffer is saved. */
export function getFileExtension(name: string): FileExtension | null {
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();

  if (extension === ".draw") {
    return extension;
  }

  return TEXT_EXTENSIONS.find((supported) => supported === extension) ?? null;
}

/** Whether a file can be opened by the markdown editor. */
export function isTextFile(name: string) {
  const extension = getFileExtension(name);

  return extension !== null && extension !== ".draw";
}

/** A file's kind, from its extension. */
export function kindOf(fileName: string): EditorKind {
  return getFileExtension(fileName) === BUFFER_EXTENSIONS.drawing
    ? "drawing"
    : "markdown";
}

// Titles
/** A file's name without its folders or extension, which is its buffer title. */
export function stemOf(fileName: string) {
  const name = baseNameOf(fileName);

  return name.slice(0, name.lastIndexOf("."));
}

/** Buffer titles are snake_case: lowercase, with whitespace and slashes turned into `_`. */
export function toBufferTitle(input: string) {
  return input
    .toLowerCase()
    .replaceAll(INVALID_NAME_CHARACTERS, "_")
    .replaceAll(/\s/gu, "_");
}

// Saved and synced names
/** A safe saved path to markdown or a drawing. */
export function isSavedFileName(name: string) {
  return isSafeSavedPath(name) && getFileExtension(baseNameOf(name)) !== null;
}

/** A safe saved path to markdown, a drawing, or an image they embed. */
export function isSyncedFileName(name: string) {
  return (
    isSavedFileName(name) ||
    (isSafeSavedPath(name) && isImageFileName(baseNameOf(name)))
  );
}

/** A typed title as a file stem: trimmed, with slashes and null characters as `_`. */
export function toFileStem(title: string) {
  return title.trim().replaceAll(INVALID_NAME_CHARACTERS, "_");
}
