/** Serializes operations by identity; callers receive errors and later operations can retry. */
export function createOperationQueue() {
  const pending = new Map<string, Promise<void>>();

  return async function queueOperation<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = pending.get(key) ?? Promise.resolve();
    const result = previous.then(operation);

    // The queue tracks completion; rejection still reaches the caller through result.
    const settled = result.then(
      () => undefined,
      () => undefined,
    );

    pending.set(key, settled);

    try {
      return await result;
    } finally {
      if (pending.get(key) === settled) {
        pending.delete(key);
      }
    }
  };
}
