/** Text extensions accepted by the markdown editor. */
const TEXT_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

export type FileExtension = (typeof TEXT_EXTENSIONS)[number] | ".draw";

/** Half-open JavaScript string offsets for highlighting a search match. */
export type SearchMatchRange = [start: number, end: number];

/** A saved file returned by file-name or content search. */
export type FileSearchMatch = {
  name: string;
  lineNumber?: number;
  lineContent?: string;
  lineMatchRanges?: SearchMatchRange[];
};

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

/** A tracked external file; browsers expose no paths, so a generated ID keys its file handle. */
export type ExternalFile = {
  id: string;
  name: string;
};

/** A saved file or tracked external file the sidebar can act on. */
export type FileTarget =
  | { kind: "saved"; name: string }
  | { kind: "external"; id: string; name: string };

/** Slashes and null characters cannot appear in a file title. */
export const INVALID_FILE_TITLE_CHARACTERS = /[/\\\0]/gu;

/** Separate saved names from external file IDs in menus and operation queues. */
export function fileKey(target: FileTarget) {
  return target.kind === "saved"
    ? `saved:${target.name}`
    : `external:${target.id}`;
}

/** Default file extensions for new buffers. */
export const BUFFER_EXTENSIONS = { markdown: ".md", drawing: ".draw" } as const;

/** A file's name without its extension, which is its buffer title. */
export function stemOf(fileName: string) {
  return fileName.slice(0, fileName.lastIndexOf("."));
}
