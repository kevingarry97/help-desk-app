# E2E specs

Playwright collects `*.spec.ts` from this directory. The harness beside it —
`../test-env.ts`, `../global-setup.ts` — is not collected.

Before writing the first one:

- **Never call `signIn` in a test.** Better Auth allows 3 sign-ins per 10s per IP, the
  counters are persisted in Postgres, and every worker shares `127.0.0.1`. Global setup
  clears the counter after minting its own sessions, so the suite starts with all three —
  `login-redirect.spec.ts` claims one, leaving headroom for retries. Use the saved state:

  ```ts
  import { test } from "@playwright/test";
  import { STORAGE_STATE } from "../test-env";

  test.use({ storageState: STORAGE_STATE.admin }); // or .agent
  ```

  `login-redirect.spec.ts` is the one spec that exercises the login form; add to it rather
  than creating a second.

- **The seeded accounts are the only accounts** — sign-up is disabled. `admin@e2e.test` and
  `agent@e2e.test`, credentials in `../test-env.ts`.

- **The database is reset once per run, not per test.** Specs that mutate data must not
  assume a pristine table. `truncateAll()` from `server/prisma/test-db.ts` wipes the seeded
  users too, so scope any per-test cleanup to the tables you touched.

- **Navigate to `baseURL` (5174), never to the API directly.** The client's auth-client has
  no `baseURL` and talks to the page origin, so the Vite proxy is load-bearing for auth.
