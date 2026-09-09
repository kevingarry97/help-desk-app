import { expect, test } from "@playwright/test";

import { resetRateLimits } from "../reset-rate-limits";
import { ADMIN, STORAGE_STATE } from "../test-env";


test.describe("the API auth boundary", () => {
  test("rejects an unauthenticated request to a protected endpoint", async ({ request }) => {
    const response = await request.get("/api/tickets");

    expect(response.status()).toBe(401);
  });

  test("refuses sign-up even though the endpoint is mounted", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      headers: { origin: "http://localhost:5174" },
      data: {
        email: "intruder@e2e.test",
        password: "intruder-password",
        name: "Intruder",
      },
    });

    expect(response.ok()).toBe(false);

    // And no account was created as a side effect: signing in as them fails too.
    resetRateLimits();
    const signIn = await request.post("/api/auth/sign-in/email", {
      headers: { origin: "http://localhost:5174" },
      data: { email: "intruder@e2e.test", password: "intruder-password" },
    });

    expect(signIn.ok()).toBe(false);
  });

  test("throttles repeated sign-in attempts from one client", async ({ request }) => {
    resetRateLimits();

    const statuses: number[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request.post("/api/auth/sign-in/email", {
        headers: { origin: "http://localhost:5174" },
        data: { email: ADMIN.email, password: "definitely-not-the-password" },
      });

      statuses.push(response.status());
    }

    // The limiter must engage rather than letting all five through — this is the control
    // for the header-spoofing bypass that an earlier review found.
    expect(statuses).toContain(429);

    // Leave a clean budget so a later spec does not inherit the exhausted counter.
    resetRateLimits();
  });

  test.describe("with a signed-in agent", () => {
    test.use({ storageState: STORAGE_STATE.agent });

    test("accepts the browser session cookie", async ({ page }) => {
      // page.request rather than the bare request fixture: it shares the page's cookie jar,
      // which is what makes this a test of the real browser credential.
      await page.goto("/");

      const response = await page.request.get("/api/tickets");

      expect(response.status()).toBe(200);
      expect(Array.isArray(await response.json())).toBe(true);
    });
  });
});
