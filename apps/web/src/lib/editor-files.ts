/** A tracked external file; browsers expose no paths, so a generated ID keys its file handle. */
export type ExternalFile = {
  id: string;
  name: string;
};

/** A saved file or tracked external file the sidebar can act on. */
export type FileTarget =
  | { kind: "saved"; name: string }
  | { kind: "external"; id: string; name: string };

/** Separate saved names from external file IDs in menus and operation queues. */
export function fileKey(target: FileTarget) {
  return target.kind === "saved"
    ? `saved:${target.name}`
    : `external:${target.id}`;
}
