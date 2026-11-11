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

/** An open buffer's file followed by the file watcher. */
export type WatchedFile =
  | { kind: "saved"; name: string }
  | { kind: "external"; path: string };

/** A watched file's markdown after another program wrote it. */
export type WatchedFileChange = WatchedFile & { content: string };

/** Separate saved names from canonical external paths in menus and operation queues. */
export function fileKey(target: FileTarget) {
  return target.kind === "saved"
    ? `saved:${target.name}`
    : `external:${target.path}`;
}
