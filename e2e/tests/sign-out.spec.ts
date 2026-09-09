import { expect, test } from "@playwright/test";

import {
  expectOnDashboard,
  expectOnLogin,
  signInThroughApi,
  signOutButton,
  usersHeading,
  usersLink,
} from "../helpers";
import { ADMIN } from "../test-env";

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
  await signInThroughApi(context, ADMIN);
});

test("lands on /login and leaves no session behind", async ({ page }) => {
  await page.goto("/");
  await expectOnDashboard(page);

  await signOutButton(page).click();

  await expectOnLogin(page);

  // A fresh load of a protected route is the real check. If sign-out had only cleared client
  // state, the cookie would still be valid here and this would reach the dashboard.
  await page.goto("/");
  await expectOnLogin(page);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("does not restore the dashboard through browser Back", async ({ page }) => {
  await page.goto("/");
  // Push a second history entry so Back has somewhere to go: sign-out navigates with
  // replace, which would otherwise leave nothing behind /login.
  await usersLink(page).click();
  await expect(page).toHaveURL(/\/users$/);

  await signOutButton(page).click();
  await expectOnLogin(page);

  await page.goBack();

  // The guard must re-run on a restored entry. A bfcache hit that skipped it would leave the
  // previous user's page on screen after they signed out on a shared machine.
  await expectOnLogin(page);
  await expect(usersHeading(page)).toHaveCount(0);
});
