import { expect, test } from "@playwright/test";

import { ADMIN } from "../test-env";

/**
 * The one file that signs in through the form. Better Auth allows 3 sign-ins per 10s per IP;
 * global setup clears the counter after minting its own sessions, so this starts with the
 * full budget and has room to be retried. Keep form sign-ins to this file — a second one
 * elsewhere puts the suite back at the ceiling.
 *
 * It earns that cost: the deep-link round trip spans ProtectedRoute stashing the location,
 * a real credential exchange, and LoginPage reconstructing pathname + search + hash. Only a
 * browser holds that router state across the redirect.
 */
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
