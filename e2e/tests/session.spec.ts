import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "../test-env";

const SESSION_COOKIE = "session_token";

test.describe("an established session", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("redirects away from /login instead of showing the form again", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
  });

  test("keeps the session token out of reach of page scripts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");

    // Only a real browser can show this: the cookie is present and authenticating the
    // request, yet invisible to any script an XSS would run.
    const readable = await page.evaluate(() => document.cookie);
    expect(readable).not.toContain(SESSION_COOKIE);

    const session = (await page.context().cookies()).find((c) =>
      c.name.includes(SESSION_COOKIE),
    );

    expect(session, "expected a session cookie to have been issued").toBeTruthy();
    expect(session?.httpOnly).toBe(true);
  });

  test("falls back to /login once the cookie is cleared mid-session", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");

    await context.clearCookies();

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("treats a tampered session cookie as anonymous", async ({ page, context }) => {
    await page.goto("/");

    const session = (await context.cookies()).find((c) => c.name.includes(SESSION_COOKIE));
    expect(session, "expected a session cookie to tamper with").toBeTruthy();

    await context.clearCookies();
    await context.addCookies([
      // Same name and domain, corrupted value: the signature no longer matches, so the
      // server must reject it rather than trusting the payload it carries.
      { ...session!, value: `${session!.value.slice(0, -6)}tamper` },
    ]);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
