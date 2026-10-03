import { toast } from "@lunarscribe/components/ui/toast";
import { errorMessage } from "@lunarscribe/utils/error-message";

/** Transient file failures use toasts; failed external opens remain in the page alert. */
export function reportFileError(
  cause: unknown,
  title: string,
  fallback: string,
) {
  toast.add({
    type: "error",
    title,
    description: errorMessage(cause, fallback),
  });
}

/** Handles a user action's rejection before an event handler discards its promise. */
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
