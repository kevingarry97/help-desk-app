/**
 * Prisma's "an operation failed because it depends on one or more records that were
 * required but not found" — raised by update/delete when the `where` matches nothing.
 * Worth narrowing to: a connection failure (P1001) must not be reported to the caller
 * as a missing row.
 */
export function isRecordNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null | undefined)?.code === "P2025";
}
