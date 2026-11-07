import {
  ImageNotFound01Icon,
  SecurityBlockIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@lunarscribe/components/ui/alert";
import { cn } from "@lunarscribe/utils/cn";
import {
  IMAGE_FORMAT_NAMES,
  isImageFileName,
  isUrlTarget,
} from "@lunarscribe/utils/images";
import { baseNameOf } from "@lunarscribe/utils/saved-paths";
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, type NodeKey } from "lexical";
import { type CSSProperties, useContext, useEffect, useState } from "react";

import { EditorImagesContext, type ImageSource } from "./image-context";

/**
 * The URL of a remote image, or null when it is unsafe to load: only `http:` and `https:`
 * URLs with a host, and no spaces, control characters, or embedded credentials.
 */
function sanitizeRemoteImageUrl(target: string) {
  if (/[\p{Cc}\s]/u.test(target)) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(target);
  } catch {
    return null;
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    return null;
  }

  return url.href;
}

type ImageProblem = { title: string; description: string; blocked?: boolean };

/** The display width of an embed, which the image's aspect ratio scales the height to. */
type ImageStyle = CSSProperties & { "--image-width"?: string };

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function fileNameOf(target: string) {
  const name = baseNameOf(target);

  try {
    return decodeURI(name);
  } catch {
    return name;
  }
}

/** The problem an embed shows in place of its image, worded for the writer. */
function describeProblem(
  target: string,
  source: ImageSource | null,
  didLoadFail: boolean,
): ImageProblem | null {
  if (isUrlTarget(target)) {
    if (sanitizeRemoteImageUrl(target) === null) {
      return {
        title: "Image link blocked",
        description:
          "Only http:// and https:// image links can be shown. Check the link in this embed.",
        blocked: true,
      };
    }

    return didLoadFail
      ? {
          title: "Image couldn't load",
          description: `The image from ${hostOf(target)} isn't available. Check the link and your connection.`,
        }
      : null;
  }

  const name = fileNameOf(target);

  if (!isImageFileName(target)) {
    return {
      title: "Not an image",
      description: `“${name}” isn't an image file. Embed a ${IMAGE_FORMAT_NAMES} file.`,
    };
  }

  if (source?.status === "missing") {
    return {
      title: "Image not found",
      description: `“${name}” isn't next to this note. Move the image into the note's folder, or fix the file name in the embed.`,
    };
  }

  if (source?.status === "unavailable") {
    return { title: "Image unavailable", description: source.reason };
  }

  if (didLoadFail) {
    return {
      title: "Image couldn't open",
      description: `“${name}” may be damaged or saved in a format this device can't show.`,
    };
  }

  return null;
}

const NO_FILE_ACCESS: ImageSource = {
  status: "unavailable",
  reason: "Images from files can't be shown here.",
};

/** The URL to load for `target`: remote links directly, local files through the app. */
function useImageSource(target: string) {
  const images = useContext(EditorImagesContext);
  const resolveImage = images?.resolveImage;
  const revision = images?.revision ?? 0;
  const remote = isUrlTarget(target) ? sanitizeRemoteImageUrl(target) : null;
  const needsApp = !isUrlTarget(target) && isImageFileName(target);

  const [resolved, setResolved] = useState<{
    target: string;
    source: ImageSource;
  } | null>(null);

  useEffect(() => {
    if (!needsApp || !resolveImage) {
      return;
    }

    let isCurrent = true;

    const settle = (source: ImageSource) => {
      if (isCurrent) {
        // Keep the same object when nothing changed, so the image never reloads.
        setResolved((previous) =>
          previous?.target === target &&
          JSON.stringify(previous.source) === JSON.stringify(source)
            ? previous
            : { target, source },
        );
      }
    };

    resolveImage(target).then(settle, (cause: unknown) =>
      settle({
        status: "unavailable",
        reason:
          cause instanceof Error
            ? cause.message
            : "The image file couldn't be read.",
      }),
    );

    return () => {
      isCurrent = false;
    };
  }, [needsApp, resolveImage, target, revision]);

  if (remote) {
    return {
      source: { status: "ready", src: remote } as const,
      pending: false,
    };
  }

  if (needsApp && !resolveImage) {
    return { source: NO_FILE_ACCESS, pending: false };
  }

  const source = resolved?.target === target ? resolved.source : null;

  return { source, pending: needsApp && source === null };
}

/**
 * Shows an embedded image at its own aspect ratio, no wider than 80% of the document,
 * or a message in its place when the file is missing or cannot load. A click selects it,
 * so Backspace or Delete removes the embed.
 */
export function ImageComponent({
  nodeKey,
  target,
  alt,
  width,
}: {
  nodeKey: NodeKey;
  target: string;
  alt: string;
  width: number | null;
}) {
  const [editor] = useLexicalComposerContext();

  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);

  const { source, pending } = useImageSource(target);
  const src = source?.status === "ready" ? source.src : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const problem = describeProblem(
    target,
    source,
    src !== null && failedSrc === src,
  );

  useEffect(
    () =>
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          const element = editor.getElementByKey(nodeKey);

          if (
            !editor.isEditable() ||
            !(event.target instanceof Node) ||
            !element?.contains(event.target)
          ) {
            return false;
          }

          if (!event.shiftKey) {
            clearSelection();
          }

          setSelected(true);

          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor, nodeKey, setSelected, clearSelection],
  );

  const style: ImageStyle | undefined =
    width === null ? undefined : { "--image-width": `${width}px` };

  return (
    <div
      contentEditable={false}
      data-image-pending={pending ? "" : undefined}
      className={cn(
        "my-3 w-fit max-w-4/5 rounded-lg",
        isSelected && "ring-ring ring-offset-background ring-2 ring-offset-2",
      )}
    >
      {problem ? (
        <Alert
          role="note"
          variant={problem.blocked ? "destructive" : "default"}
          data-image-error={`${problem.title}: ${problem.description}`}
        >
          <HugeiconsIcon
            icon={problem.blocked ? SecurityBlockIcon : ImageNotFound01Icon}
            strokeWidth={2}
          />
          <AlertTitle>{problem.title}</AlertTitle>
          <AlertDescription>{problem.description}</AlertDescription>
        </Alert>
      ) : (
        src && (
          <img
            src={src}
            alt={alt || fileNameOf(target)}
            draggable={false}
            decoding="async"
            referrerPolicy="no-referrer"
            style={style}
            className={cn(
              "block h-auto max-w-full rounded-sm",
              width !== null && "w-(--image-width)",
            )}
            onError={() => setFailedSrc(src)}
            onLoad={() => setFailedSrc(null)}
          />
        )
      )}
    </div>
  );
}
