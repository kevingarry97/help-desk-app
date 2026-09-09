import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "../test-env";

test.describe("anonymous visitor", () => {
  test("is redirected from a protected route to /login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("is redirected from an unknown route to /login", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("signed in as agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("reaches the dashboard", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
  });

  test("is redirected away from the admin-only /users", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
  });

  test("is not offered the Users link", async ({ page }) => {
    await page.goto("/");

    // Wait for the navbar itself before asserting something is missing from it —
    // toBeHidden() is satisfied by an element that has not rendered yet, so without this
    // the assertion can pass while React is still mounting.
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  });

  test("keeps the session across a full page reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");

    await page.reload();

    // Still on the dashboard rather than bounced to /login: the session came from the
    // server, not from anything held in memory by the SPA.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
  });
});

test.describe("signed in as admin", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("reaches the admin-only /users", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("navigates to /users through the nav link", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Users" }).click();

    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });
});
