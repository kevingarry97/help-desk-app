import { expect, test } from "@playwright/test";

import {
  SESSION_COOKIE,
  expectOnDashboard,
  expectOnLogin,
  requireSessionCookie,
} from "../helpers";
import { STORAGE_STATE } from "../test-env";

test.describe("an established session", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("redirects away from /login instead of showing the form again", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveURL(/\/$/);
    await expectOnDashboard(page);
  });

  test("keeps the session token out of reach of page scripts", async ({ page }) => {
    await page.goto("/");
    await expectOnDashboard(page);

    // Only a real browser can show this: the cookie is present and authenticating the
    // request, yet invisible to any script an XSS would run.
    const readable = await page.evaluate(() => document.cookie);
    expect(readable).not.toContain(SESSION_COOKIE);

    const session = await requireSessionCookie(
      page.context(),
      "expected a session cookie to have been issued",
    );

    expect(session.httpOnly).toBe(true);
  });

  test("falls back to /login once the cookie is cleared mid-session", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expectOnDashboard(page);

    await context.clearCookies();

    await page.goto("/");
    await expectOnLogin(page);
  });

  test("treats a tampered session cookie as anonymous", async ({ page, context }) => {
    await page.goto("/");

    const session = await requireSessionCookie(
      context,
      "expected a session cookie to tamper with",
    );

    await context.clearCookies();
    await context.addCookies([
      // Same name and domain, corrupted value: the signature no longer matches, so the
      // server must reject it rather than trusting the payload it carries.
      { ...session, value: `${session.value.slice(0, -6)}tamper` },
    ]);

    await page.goto("/");
    await expectOnLogin(page);
  });
});
