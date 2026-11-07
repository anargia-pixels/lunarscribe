/** The markdown file an image embed belongs to; images sit next to it. */
export type ImageNote =
  | {
      kind: "saved";
      /** The saved file, or null for a new buffer that saves into `folder`. */
      name: string | null;
      folder: string;
    }
  | { kind: "external"; path: string };

/** A dropped or pasted image to copy next to its note. */
export type ImageUpload = { name: string; bytes: Uint8Array<ArrayBuffer> };

/** Where an embed's file was found, matching the editor's image source. */
export type ResolvedImage =
  | { status: "ready"; src: string }
  | { status: "missing" }
  | { status: "unavailable"; reason: string };
