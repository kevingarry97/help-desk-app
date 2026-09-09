import { defineConfig, devices } from "@playwright/test";

import { BASE_URL, CLIENT_PORT, SERVER_URL, clientEnv, serverEnv } from "./e2e/test-env";

export default defineConfig({
  // Specs live in e2e/tests; the harness modules beside it are not collected.
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",

  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // No storageState here on purpose — auth-redirect tests need an anonymous context.
  // Authenticated specs opt in with `test.use({ storageState: STORAGE_STATE.admin })`.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      // `start`, not `dev`: no --hot reload mid-suite.
      command: "bun run start",
      cwd: "./server",
      // Liveness endpoint, which runs no query — so it goes green before globalSetup has
      // created the database.
      url: `${SERVER_URL}/api/health`,
      env: serverEnv,
      // Never reuse: a stale process on these ports may have been started with a different
      // VITE_API_URL/DATABASE_URL, and reusing it would silently run the suite against the
      // development database.
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
    },
    {
      // Vite must run under Bun: Vite 8 wants Node 20.19+ and this machine has 20.18.2.
      // --strictPort so a busy 5174 fails loudly instead of silently moving to 5175.
      command: `bunx --bun vite --port ${CLIENT_PORT} --strictPort`,
      cwd: "./client",
      url: BASE_URL,
      env: clientEnv,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    },
  ],
});
