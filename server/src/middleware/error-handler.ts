import type { ErrorRequestHandler } from "express";

import { isUniqueViolation } from "../lib/prisma-errors";

const STATUS_TEXT: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  413: "Request body too large",
  415: "Unsupported media type",
  429: "Too many requests",
};

/**
 * Each candidate is tested for a usable number in turn — `err.status ?? err.statusCode`
 * would short-circuit on a present-but-non-numeric `status`, which is exactly what
 * Better Auth's APIError carries ("UNAUTHORIZED" alongside `statusCode: 401`), and report
 * a 401 as a 500.
 */
function statusOf(err: unknown): number {
  const candidate = err as { status?: unknown; statusCode?: unknown } | null | undefined;

  for (const value of [candidate?.status, candidate?.statusCode]) {
    if (typeof value === "number" && value >= 400 && value < 600) return value;
  }

  return 500;
}

/**
 * Last-resort handler, mounted after every route. Without it Express 5's default handler
 * leaks the stack trace to the caller outside production.
 *
 * Client errors keep their status but not their text: a thrown message is written by
 * whatever library raised it, and body-parser's includes a slice of the request body.
 * Routes that want to say something specific respond themselves.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // A unique-constraint race — two requests creating the same row at once — is the caller's
  // conflict, not a server fault. Routes let it throw rather than catching it themselves.
  const status = isUniqueViolation(err) ? 409 : statusOf(err);

  if (status >= 500) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // Logged too: a 4xx that reaches here was thrown, not deliberately returned.
  console.error(err);
  res.status(status).json({ error: STATUS_TEXT[status] ?? "Request failed" });
};
