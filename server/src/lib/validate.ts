import type { Response } from "express";
import { z } from "zod/v4";

/**
 * Success carries the parsed body; failure carries nothing, because the 400 has already
 * been sent. Deliberately not "parsed data or null" — a schema whose valid output is
 * falsy (`z.boolean()`, `z.number()` over a legitimate 0) would make the caller's bail-out
 * fire on a good request and leave it hanging with no response written.
 */
type ValidationResult<T> = { ok: true; data: T } | { ok: false };

/**
 * Parses a request body against a schema, responding 400 with the issue list if it does
 * not match. Callers bail with `if (!result.ok) return;`.
 */
export function validate<S extends z.ZodType>(
  schema: S,
  body: unknown,
  res: Response,
): ValidationResult<z.infer<S>> {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      error: "Invalid request body",
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return { ok: false };
  }

  return { ok: true, data: result.data };
}
