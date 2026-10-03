/** A useful message for an error, with an operation-specific fallback. */
export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
