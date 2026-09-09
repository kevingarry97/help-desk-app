import { expect, test } from "@playwright/test";

import { resetRateLimits } from "../reset-rate-limits";
import { ADMIN } from "../test-env";

/**
 * The one file that signs in through the form, per e2e/tests/README.md. Better Auth allows
 * 3 sign-ins per 10s per IP and the counters are persisted, so each test here clears them
 * first — otherwise the third test in the file 429s on a limit the earlier two consumed.
 *
 * These earn a browser: the deep-link round trip spans ProtectedRoute stashing the location,
 * a real credential exchange, and LoginPage reconstructing pathname + search + hash, and the
 * failure cases assert that no session cookie is issued — none of which survives mocking.
 */
test.beforeEach(() => {
  resetRateLimits();
});

test("returns to the originally requested URL, query and hash intact, after signing in", async ({
  page,
}) => {
  await page.goto("/users?tab=agents#list");

  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/users?tab=agents#list");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
});

test("signs in from /login itself and lands on the dashboard", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
});

test("refuses a wrong password and issues no session", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  // The decisive part: a protected route still bounces, so the failed attempt left no
  // usable cookie behind.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("does not reveal whether an email is registered", async ({ page }) => {
  const messageFor = async (email: string, password: string) => {
    resetRateLimits();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    return (await page.getByRole("alert").textContent())?.trim();
  };

  const wrongPassword = await messageFor(ADMIN.email, "definitely-not-the-password");
  const unknownEmail = await messageFor("nobody@e2e.test", "definitely-not-the-password");

  // Compared rather than hardcoded: the security property is that the two are
  // indistinguishable, not that either has any particular wording.
  expect(unknownEmail).toBe(wrongPassword);
});
