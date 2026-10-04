import { toast } from "@lunarscribe/components/ui/toast";
import { errorMessage } from "@lunarscribe/utils/error-message";

import { formatFileMessage } from "./file-message";

/** Report file action failures while external-open errors stay on the page. */
export function reportFileError(
  cause: unknown,
  title: string,
  fallback: string,
) {
  toast.add({
    type: "error",
    title,
    description: formatFileMessage(errorMessage(cause, fallback)),
  });
}

/** Report action failures before an event handler discards the promise. */
export async function runFileAction(
  action: () => Promise<void>,
  title: string,
  fallback: string,
) {
  try {
    await action();
  } catch (cause) {
    reportFileError(cause, title, fallback);
  }
}
