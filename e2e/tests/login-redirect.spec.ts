import { expect, test } from "@playwright/test";

import { expectOnDashboard, expectOnLogin, signInThroughForm, usersHeading } from "../helpers";
import { ADMIN } from "../test-env";

/**
 * The one file that signs in through the form, per e2e/tests/README.md. Every sign-in below
 * goes through `signInThroughForm`, which clears Better Auth's persisted 3-per-10s counters
 * before submitting — without that the third test here 429s on a limit the earlier two
 * consumed, and the failure looks nothing like the behaviour under test.
 *
 * These earn a browser: the deep-link round trip spans ProtectedRoute stashing the location,
 * a real credential exchange, and LoginPage reconstructing pathname + search + hash, and the
 * failure cases assert that no session cookie is issued — none of which survives mocking.
 */

test("returns to the originally requested URL, query and hash intact, after signing in", async ({
  page,
}) => {
  await page.goto("/users?tab=agents#list");

  await expectOnLogin(page);

  await signInThroughForm(page, ADMIN);

  await expect(page).toHaveURL("/users?tab=agents#list");
  await expect(usersHeading(page)).toBeVisible();
});

test("signs in from /login itself and lands on the dashboard", async ({ page }) => {
  await page.goto("/login");

  await signInThroughForm(page, ADMIN);

  await expect(page).toHaveURL(/\/$/);
  await expectOnDashboard(page);
});

test("refuses a wrong password and issues no session", async ({ page }) => {
  await page.goto("/login");

  await signInThroughForm(page, {
    email: ADMIN.email,
    password: "definitely-not-the-password",
  });

  await expect(page.getByRole("alert")).toBeVisible();
  await expectOnLogin(page);

  // The decisive part: a protected route still bounces, so the failed attempt left no
  // usable cookie behind.
  await page.goto("/");
  await expectOnLogin(page);
});

test("does not reveal whether an email is registered", async ({ page }) => {
  const messageFor = async (email: string, password: string) => {
    await page.goto("/login");
    await signInThroughForm(page, { email, password });

    await expect(page.getByRole("alert")).toBeVisible();
    return (await page.getByRole("alert").textContent())?.trim();
  };

  const wrongPassword = await messageFor(ADMIN.email, "definitely-not-the-password");
  const unknownEmail = await messageFor("nobody@e2e.test", "definitely-not-the-password");

  // Compared rather than hardcoded: the security property is that the two are
  // indistinguishable, not that either has any particular wording.
  expect(unknownEmail).toBe(wrongPassword);
});
