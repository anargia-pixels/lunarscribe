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
