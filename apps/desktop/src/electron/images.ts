import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import {
  availableImageName,
  imageMimeType,
  isImageFileName,
  isUrlTarget,
  resolveRelativeImagePath,
  resolveSavedImage,
  toImageFileName,
} from "@lunarscribe/utils/images";
import type { createOperationQueue } from "@lunarscribe/utils/operation-queue";
import { folderOf } from "@lunarscribe/utils/saved-paths";
import { ipcMain, protocol } from "electron";

import type { ImageNote, ImageUpload, ResolvedImage } from "../lib/images";
import { isOpenedExternalPath } from "./external-files";
import { listSavedEntries, resolveSavedPath } from "./saved-path";

/** The scheme image files load through; the renderer cannot read `file:` URLs. */
const IMAGE_SCHEME = "lunarscribe-image";

/** Lets `<img>` load the image scheme; Electron requires this before the app is ready. */
export function registerImageScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMAGE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

/** The saved folder a note's images sit in; a new buffer uses the folder it saves into. */
function folderOfNote(note: Extract<ImageNote, { kind: "saved" }>) {
  return note.name === null ? note.folder : folderOf(note.name);
}

function notFound() {
  return new Response(null, { status: 404 });
}

/**
 * Finds image embeds next to markdown files and copies dropped images there. Only files
 * an embed resolved to are served, so the renderer cannot read other paths. Call
 * `invalidate` when the documents folder changes.
 */
export function registerImages(
  folder: string,
  queue: ReturnType<typeof createOperationQueue>,
) {
  const servedPaths = new Set<string>();
  let savedImages: Promise<string[]> | null = null;

  /** Every saved image path, for embeds that name an image anywhere in the folder. */
  const listSavedImages = () => {
    savedImages ??= listSavedEntries(folder, isImageFileName).then(
      (entries) => entries.files,
      (cause: unknown) => {
        savedImages = null;

        throw cause;
      },
    );

    return savedImages;
  };

  async function serve(path: string): Promise<ResolvedImage> {
    try {
      const metadata = await stat(path);

      if (!metadata.isFile()) {
        return { status: "missing" };
      }

      servedPaths.add(path);

      // The modification time reloads the image after it changes on disk.
      return {
        status: "ready",
        src: `${IMAGE_SCHEME}://local/${encodeURIComponent(path)}?v=${Math.round(metadata.mtimeMs)}`,
      };
    } catch {
      return { status: "missing" };
    }
  }

  async function resolveImage(
    note: ImageNote,
    target: string,
  ): Promise<ResolvedImage> {
    if (isUrlTarget(target) || !isImageFileName(target)) {
      return { status: "missing" };
    }

    if (note.kind === "external") {
      if (!isOpenedExternalPath(note.path)) {
        return {
          status: "unavailable",
          reason: "Open this file again to show its images.",
        };
      }

      let relative = target;

      try {
        relative = decodeURI(target);
      } catch {
        // Keep a target with a stray `%` as written.
      }

      if (isAbsolute(relative)) {
        return {
          status: "unavailable",
          reason:
            "Embed images by their path from this file, such as photo.png or images/photo.png.",
        };
      }

      return serve(resolve(dirname(note.path), relative));
    }

    const noteFolder = folderOfNote(note);

    // Most embeds are next to the note, so check the disk before listing every image.
    for (const candidate of [
      resolveRelativeImagePath(noteFolder, target),
      resolveRelativeImagePath("", target),
    ]) {
      if (candidate && existsSync(resolveSavedPath(folder, candidate))) {
        return serve(resolveSavedPath(folder, candidate));
      }
    }

    const name = resolveSavedImage(noteFolder, target, await listSavedImages());

    return name ? serve(resolveSavedPath(folder, name)) : { status: "missing" };
  }

  /** Copies each image next to the note, never over another file; returns embed targets. */
  async function saveImages(note: ImageNote, uploads: ImageUpload[]) {
    let destination: string;

    if (note.kind === "external") {
      if (!isOpenedExternalPath(note.path)) {
        throw new Error("Open this file again before adding images to it.");
      }

      destination = dirname(note.path);
    } else {
      const noteFolder = folderOfNote(note);

      destination = noteFolder ? resolveSavedPath(folder, noteFolder) : folder;
    }

    const write = async () => {
      const targets: string[] = [];

      await mkdir(destination, { recursive: true });

      for (const upload of uploads) {
        const name = toImageFileName(upload.name, "");

        if (!name) {
          throw new Error(
            `“${upload.name}” isn't an image file Lunarscribe can embed.`,
          );
        }

        const target = availableImageName("", name, (candidate) =>
          existsSync(join(destination, candidate)),
        );

        await writeFile(join(destination, target), upload.bytes, {
          flag: "wx",
        });
        targets.push(target);
      }

      savedImages = null;

      return targets;
    };

    return note.kind === "saved" ? queue(folder, write) : write();
  }

  protocol.handle(IMAGE_SCHEME, async (request) => {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname.slice(1));

    if (url.host !== "local" || !servedPaths.has(path)) {
      return notFound();
    }

    try {
      return new Response(new Uint8Array(await readFile(path)), {
        headers: {
          "Content-Type": imageMimeType(path),
          // An SVG opened on its own must not run scripts or load anything.
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      return notFound();
    }
  });

  ipcMain.handle("images:resolve", (_event, note: ImageNote, target: string) =>
    resolveImage(note, target),
  );
  ipcMain.handle(
    "images:save",
    (_event, note: ImageNote, uploads: ImageUpload[]) =>
      saveImages(note, uploads),
  );

  return {
    invalidate: () => {
      savedImages = null;
    },
  };
}
