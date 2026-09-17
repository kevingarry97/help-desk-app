import type { Response } from "express";
import { z } from "zod/v4";

type ValidationResult<T> = { ok: true; data: T } | { ok: false };

/** Where the input came from, so the 400 names the part of the request that was wrong. */
type Source = "body" | "query";

const ERROR: Record<Source, string> = {
  body: "Invalid request body",
  query: "Invalid query parameters",
};

export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
  res: Response,
  source: Source = "body",
): ValidationResult<z.infer<S>> {
  const result = schema.safeParse(input);

  if (!result.success) {
    res.status(400).json({
      error: ERROR[source],
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return { ok: false };
  }

  return { ok: true, data: result.data };
}
