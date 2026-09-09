import { expect, test } from "@playwright/test";

import { resetRateLimits } from "../reset-rate-limits";
import { ADMIN, BASE_URL } from "../test-env";

/**
 * Sign-out is only meaningful end to end: the assertion that matters is that the session is
 * gone on the *server*, which a component test mocking the auth client cannot show.
 *
 * These deliberately do NOT use STORAGE_STATE. Signing out revokes the token in that file
 * server-side, which would leave every later spec sharing it silently anonymous — a failure
 * that surfaces as an unrelated missing element and depends on spec ordering. Each test
 * mints a throwaway session into its own context instead.
 */
test.beforeEach(async ({ context }) => {
  resetRateLimits();

  const response = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: BASE_URL },
    data: { email: ADMIN.email, password: ADMIN.password },
  });

  expect(response.ok(), "failed to mint a session for the sign-out test").toBe(true);
});

test("lands on /login and leaves no session behind", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);

  // A fresh load of a protected route is the real check. If sign-out had only cleared client
  // state, the cookie would still be valid here and this would reach the dashboard.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("does not restore the dashboard through browser Back", async ({ page }) => {
  await page.goto("/");
  // Push a second history entry so Back has somewhere to go: sign-out navigates with
  // replace, which would otherwise leave nothing behind /login.
  await page.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/users$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goBack();

  // The guard must re-run on a restored entry. A bfcache hit that skipped it would leave the
  // previous user's page on screen after they signed out on a shared machine.
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
});
