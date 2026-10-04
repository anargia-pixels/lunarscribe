/**
 * Map items with at most `limit` operations in flight; results keep input order.
 * After a failure no new item starts, and the error is thrown once running ones settle.
 */
export async function mapConcurrent<T, R>(
  items: Iterable<T>,
  limit: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const list = [...items];
  const results: R[] = Array.from({ length: list.length });
  let next = 0;
  const failures: unknown[] = [];

  const worker = async () => {
    while (next < list.length && failures.length === 0) {
      const index = next;
      next += 1;

      try {
        results[index] = await operation(list[index]!);
      } catch (cause) {
        failures.push(cause);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, worker),
  );

  if (failures.length > 0) {
    throw failures[0];
  }

  return results;
}
