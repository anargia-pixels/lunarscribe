import { errorMessage } from "@lunarscribe/utils/error-message";
import { useRef, useState } from "react";

/** A dialog action retains its error for retry and ignores duplicate submissions. */
export function useAsyncAction(fallback: string) {
  const pending = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    if (pending.current) {
      return;
    }

    pending.current = true;
    setIsPending(true);
    setError(null);

    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause, fallback));
    } finally {
      pending.current = false;
      setIsPending(false);
    }
  }

  return { run, isPending, error };
}
