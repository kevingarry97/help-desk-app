/**
 * Prisma reports its failures as a `code` on the thrown error, but a call that passes
 * through another library's adapter — Better Auth's, here — can arrive wrapped, with the
 * Prisma error demoted to `cause`. One level of unwrapping covers that.
 */
function prismaCode(error: unknown): unknown {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null | undefined;
  return candidate?.code ?? candidate?.cause?.code;
}

/**
 * Prisma's "an operation failed because it depends on one or more records that were
 * required but not found" — raised by update/delete when the `where` matches nothing.
 * Worth narrowing to: a connection failure (P1001) must not be reported to the caller
 * as a missing row.
 */
export function isRecordNotFound(error: unknown): boolean {
  return prismaCode(error) === "P2025";
}

/** Prisma's unique constraint violation — a duplicate email, on this schema. */
export function isUniqueViolation(error: unknown): boolean {
  return prismaCode(error) === "P2002";
}
