import type {
  EditorImages,
  ImageSource,
} from "@lunarscribe/components/editor/markdown-editor";
import { toast } from "@lunarscribe/components/ui/toast";
import { imageMimeType, resolveSavedImage } from "@lunarscribe/utils/images";
import { useEffect, useMemo, useState } from "react";

import {
  listImageNames,
  onFilesChanged,
  readImage,
  saveImages,
} from "@/lib/saved-files";

/** The markdown file embeds belong to: a saved file's folder, or a file from the device. */
export type ImageNote =
  | { kind: "saved"; folder: string }
  | { kind: "external" };

const EXTERNAL_REASON =
  "The browser can't open images next to a file opened from your computer. Save the note in Lunarscribe to embed images.";

// One object URL per stored image, replaced when the image changes.
const objectUrls = new Map<string, { modifiedAt: number; url: string }>();

async function resolveStoredImage(
  folder: string,
  target: string,
): Promise<ImageSource> {
  const name = resolveSavedImage(folder, target, await listImageNames());
  const record = name ? await readImage(name) : null;

  if (!name || !record) {
    return { status: "missing" };
  }

  const cached = objectUrls.get(name);

  if (cached?.modifiedAt === record.modifiedAt) {
    return { status: "ready", src: cached.url };
  }

  if (cached) {
    URL.revokeObjectURL(cached.url);
  }

  const url = URL.createObjectURL(
    new Blob([record.content], { type: imageMimeType(name) }),
  );

  objectUrls.set(name, { modifiedAt: record.modifiedAt, url });

  return { status: "ready", src: url };
}

/** Image access for one markdown note, without the saved-files change listener. */
export function createEditorImages(
  note: ImageNote,
  revision = 0,
): EditorImages {
  return {
    resolveImage: async (target) =>
      note.kind === "saved"
        ? resolveStoredImage(note.folder, target)
        : { status: "unavailable", reason: EXTERNAL_REASON },
    saveImages: async (files) => {
      if (note.kind === "external") {
        throw new Error(EXTERNAL_REASON);
      }

      return saveImages(
        note.folder,
        await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            content: new Uint8Array(await file.arrayBuffer()),
          })),
        ),
      );
    },
    onSaveError: (message) =>
      toast.add({
        type: "error",
        title: "Unable to add the image",
        description: message,
      }),
    revision,
  };
}

/**
 * Image embeds for the markdown editor: images saved next to the buffer's file in browser
 * storage, looked up again whenever saved files change in any tab.
 */
export function useEditorImages(folder: string, isExternal: boolean) {
  const [revision, setRevision] = useState(0);

  useEffect(
    () => onFilesChanged(() => setRevision((current) => current + 1)),
    [],
  );

  return useMemo(
    () =>
      createEditorImages(
        isExternal ? { kind: "external" } : { kind: "saved", folder },
        revision,
      ),
    [folder, isExternal, revision],
  );
}

/**
 * The image viewer's source for the saved image `name`, read again when saved files
 * change; null while it loads or when no image is shown.
 */
export function useSavedImageSource(name: string | null) {
  const [revision, setRevision] = useState(0);

  const [resolved, setResolved] = useState<{
    name: string;
    source: ImageSource;
  } | null>(null);

  useEffect(
    () => onFilesChanged(() => setRevision((current) => current + 1)),
    [],
  );

  useEffect(() => {
    if (name === null) {
      return;
    }

    let isCurrent = true;

    // Encoded, so a literal `%` in the file name survives the embed decoding.
    resolveStoredImage("", encodeURI(name)).then(
      (source) => isCurrent && setResolved({ name, source }),
      () =>
        isCurrent &&
        setResolved({
          name,
          source: {
            status: "unavailable",
            reason: "The image file couldn't be read.",
          },
        }),
    );

    return () => {
      isCurrent = false;
    };
  }, [name, revision]);

  return resolved?.name === name ? resolved.source : null;
}
