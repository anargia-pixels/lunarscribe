import { ImageNotFound01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@lunarscribe/components/ui/alert";
import { baseNameOf } from "@lunarscribe/utils/saved-paths";
import { useState } from "react";

import type { ImageSource } from "./plugins/image-context";

/**
 * Shows a saved image on its own, fit inside the editor area at its aspect ratio and never
 * enlarged past its own size, as Obsidian opens an image file. `source` is null while the
 * app reads the file.
 */
export function ImageViewer({
  name,
  source,
}: {
  name: string;
  source: ImageSource | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = source?.status === "ready" ? source.src : null;
  const fileName = baseNameOf(name);

  const problem =
    source?.status === "missing"
      ? {
          title: "Image not found",
          description: `“${fileName}” was moved or deleted.`,
        }
      : source?.status === "unavailable"
        ? { title: "Image unavailable", description: source.reason }
        : src !== null && failedSrc === src
          ? {
              title: "Image couldn't open",
              description: `“${fileName}” may be damaged or saved in a format this device can't show.`,
            }
          : null;

  return (
    <div
      aria-label={`Image ${fileName}`}
      className="relative min-h-0 flex-1 overflow-hidden"
    >
      {problem ? (
        <div className="flex h-full items-center justify-center p-8">
          <div className="w-full max-w-md">
            <Alert>
              <HugeiconsIcon icon={ImageNotFound01Icon} strokeWidth={2} />
              <AlertTitle>{problem.title}</AlertTitle>
              <AlertDescription>{problem.description}</AlertDescription>
            </Alert>
          </div>
        </div>
      ) : (
        src && (
          // Centered by auto margins, so a small image keeps its own size.
          <div className="absolute inset-8">
            <img
              src={src}
              alt={fileName}
              draggable={false}
              className="absolute inset-0 m-auto max-h-full max-w-full"
              onError={() => setFailedSrc(src)}
              onLoad={() => setFailedSrc(null)}
            />
          </div>
        )
      )}
    </div>
  );
}
