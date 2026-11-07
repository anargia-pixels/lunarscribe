import { createContext } from "react";

/** What an embed's local file resolved to; the editor words the errors itself. */
export type ImageSource =
  | { status: "ready"; src: string }
  | { status: "missing" }
  | { status: "unavailable"; reason: string };

/**
 * How the app reaches image files next to the buffer's markdown file. Remote `http(s)`
 * images never reach the app: the editor sanitizes and loads them itself.
 */
export type EditorImages = {
  /** The URL for a local embed target, such as `photo.png` or `assets/photo.png`. */
  resolveImage: (target: string) => Promise<ImageSource>;
  /**
   * Copies dropped or pasted image files next to the buffer's markdown file and returns
   * the embed target for each. Leave it out where images cannot be added.
   */
  saveImages?: (files: File[]) => Promise<string[]>;
  /** Reports why a save failed, such as a full disk; the editor inserts nothing. */
  onSaveError?: (message: string) => void;
  /** Bump to resolve every embed again, such as after files changed on disk. */
  revision?: number;
};

export const EditorImagesContext = createContext<EditorImages | null>(null);
