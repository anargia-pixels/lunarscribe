import type {
  EditorImages,
  ImageSource,
} from "@lunarscribe/components/editor/markdown-editor";
import { toast } from "@lunarscribe/components/ui/toast";
import { useEffect, useMemo, useState } from "react";

import type { ImageNote } from "@/lib/images";

/** Electron prefixes main-process errors with the IPC channel; keep the message. */
function withoutIpcPrefix(message: string) {
  return message.replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/u,
    "",
  );
}

/** Image access for one markdown note, without the documents folder change listener. */
export function createEditorImages(
  note: ImageNote,
  revision = 0,
): EditorImages {
  return {
    resolveImage: (target) => window.lunarscribe.resolveImage(note, target),
    saveImages: async (files) =>
      window.lunarscribe.saveImages(
        note,
        await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })),
        ),
      ),
    onSaveError: (message) =>
      toast.add({
        type: "error",
        title: "Unable to add the image",
        description: withoutIpcPrefix(message),
      }),
    revision,
  };
}

/**
 * Image embeds for the markdown editor: files next to the buffer's saved or external
 * file, looked up again whenever the documents folder changes.
 */
export function useEditorImages(
  fileName: string | null,
  folder: string,
  externalPath: string | null,
) {
  const [revision, setRevision] = useState(0);

  useEffect(
    () =>
      window.lunarscribe.onFilesChanged(() =>
        setRevision((current) => current + 1),
      ),
    [],
  );

  return useMemo(
    () =>
      createEditorImages(
        externalPath === null
          ? { kind: "saved", name: fileName, folder }
          : { kind: "external", path: externalPath },
        revision,
      ),
    [fileName, folder, externalPath, revision],
  );
}

/**
 * The image viewer's source for the saved image `name`, read again when the documents
 * folder changes; null while it loads or when no image is shown.
 */
export function useSavedImageSource(name: string | null) {
  const [revision, setRevision] = useState(0);

  const [resolved, setResolved] = useState<{
    name: string;
    source: ImageSource;
  } | null>(null);

  useEffect(
    () =>
      window.lunarscribe.onFilesChanged(() =>
        setRevision((current) => current + 1),
      ),
    [],
  );

  useEffect(() => {
    if (name === null) {
      return;
    }

    let isCurrent = true;

    // Encoded, so a literal `%` in the file name survives the embed decoding.
    window.lunarscribe
      .resolveImage({ kind: "saved", name: null, folder: "" }, encodeURI(name))
      .then(
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
