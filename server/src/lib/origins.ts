const parsed = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * The browser origins allowed to call this API — CORS on our side, `trustedOrigins`
 * (Better Auth's CSRF allowlist) on the auth side.
 *
 * A getter rather than an exported array so an empty allowlist cannot be handed out
 * silently: every consumer takes the check with it. It is deliberately not thrown at
 * import time — prisma/seed.ts pulls this module in through lib/auth, and seeding
 * configures no HTTP layer, so it should not die on a missing CORS variable. Callers in
 * the request path (index.ts at boot, lib/auth.ts per request) are the ones that fail.
 */
export function getAllowedOrigins(): string[] {
  if (parsed.length === 0) {
    throw new Error(
      "CORS_ORIGINS is not set or is empty — copy .env.example to .env and set at " +
        "least one origin, e.g. http://localhost:5173",
    );
  }

  return parsed;
}
