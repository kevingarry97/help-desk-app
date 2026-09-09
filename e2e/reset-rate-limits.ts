import { execFileSync } from "node:child_process";
import path from "node:path";

import { serverEnv } from "./test-env";

// process.cwd(), not import.meta.url: Playwright transpiles specs to CJS, where import.meta
// is a syntax error. Playwright runs from the directory holding playwright.config.ts.
const serverDir = path.join(process.cwd(), "server");

/**
 * Truncates Better Auth's persisted sign-in counters.
 *
 * Call it before any test that submits credentials. The limit is 3 sign-ins per 10s per IP,
 * the counters live in Postgres (`rateLimit`), and every test shares 127.0.0.1 — so without
 * this a spec inherits whatever budget the previous one left and fails on a 429 that has
 * nothing to do with the behaviour under test.
 */
export function resetRateLimits(): void {
  execFileSync("bun", ["prisma/test-db.ts", "reset-rate-limits"], {
    cwd: serverDir,
    env: { ...process.env, ...serverEnv },
    stdio: "pipe",
  });
}
