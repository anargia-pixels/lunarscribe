/** Text extensions accepted by the markdown editor. */
const TEXT_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

export type FileExtension = (typeof TEXT_EXTENSIONS)[number] | ".draw";

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

/** A tracked external file; its source path preserves symlinks whose targets have other extensions. */
export type ExternalFile = {
  path: string;
  name: string;
  sourcePath?: string;
};

export type OpenedExternalFile = ExternalFile & {
  sourcePath: string;
  markdown: string;
};

/** A saved file or tracked external file the sidebar can act on. */
export type FileTarget =
  | { kind: "saved"; name: string }
  | { kind: "external"; path: string; name: string };

/** Slashes and null characters cannot appear in a file title. */
export const INVALID_FILE_TITLE_CHARACTERS = /[/\\\0]/gu;

/** Separate saved names from canonical external paths in menus and operation queues. */
export function fileKey(target: FileTarget) {
  return target.kind === "saved"
    ? `saved:${target.name}`
    : `external:${target.path}`;
}

/** Default file extensions for new buffers. */
export const BUFFER_EXTENSIONS = { markdown: ".md", drawing: ".draw" } as const;

/** A file's name without its extension, which is its buffer title. */
export function stemOf(fileName: string) {
  return fileName.slice(0, fileName.lastIndexOf("."));
}
