import type { SyncContent } from "./types";

/** Hashes saved text or image bytes as lowercase hex SHA-256. */
export type ContentHash = (content: SyncContent) => Promise<string>;

/** SHA-256 through Web Crypto, which browsers and Electron's Node have. */
export async function sha256Hex(content: SyncContent) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    content instanceof Uint8Array ? content : new TextEncoder().encode(content),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
