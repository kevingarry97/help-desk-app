import { expect, test } from "@playwright/test";

import {
  expectOnDashboard,
  expectOnLogin,
  signOutButton,
  userRows,
  usersHeading,
  usersLink,
} from "../helpers";
import { STORAGE_STATE } from "../test-env";

test.describe("anonymous visitor", () => {
  test("is redirected from a protected route to /login", async ({ page }) => {
    await page.goto("/");

    await expectOnLogin(page);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("is redirected from an unknown route to /login", async ({ page }) => {
    await page.goto("/no-such-page");

    await expectOnLogin(page);
  });
});

test.describe("signed in as agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("reaches the dashboard", async ({ page }) => {
    await page.goto("/");

    await expectOnDashboard(page);
  });

  test("is redirected away from the admin-only /users", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL(/\/$/);
    await expectOnDashboard(page);
  });

  test("is not offered the Users link", async ({ page }) => {
    await page.goto("/");

    // Wait for the navbar itself before asserting something is missing from it —
    // toBeHidden() is satisfied by an element that has not rendered yet, so without this
    // the assertion can pass while React is still mounting.
    await expect(signOutButton(page)).toBeVisible();

    await expect(usersLink(page)).toHaveCount(0);
  });

  test("keeps the session across a full page reload", async ({ page }) => {
    await page.goto("/");
    await expectOnDashboard(page);

    await page.reload();

    // Still on the dashboard rather than bounced to /login: the session came from the
    // server, not from anything held in memory by the SPA.
    await expect(page).toHaveURL(/\/$/);
    await expectOnDashboard(page);
  });
});

test.describe("signed in as admin", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("reaches the admin-only /users", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL(/\/users$/);
    await expect(usersHeading(page)).toBeVisible();

    // The heading renders whatever the API says; the rows only arrive if the admin-only
    // GET /api/users answered this session. Two, because those are the seeded accounts and
    // sign-up is disabled, so nothing in the suite can add a third.
    await expect(userRows(page)).toHaveCount(2);
  });

  test("navigates to /users through the nav link", async ({ page }) => {
    await page.goto("/");

    await usersLink(page).click();

    await expect(page).toHaveURL(/\/users$/);
    await expect(usersHeading(page)).toBeVisible();
  });
});
