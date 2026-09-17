import { expect, test } from "@playwright/test";

import {
  ORIGIN_HEADERS,
  adminApiContext,
  createTicketByEmail,
  postSignIn,
  uniqueTag,
} from "../helpers";
import { resetRateLimits } from "../reset-rate-limits";
import { ADMIN, STORAGE_STATE } from "../test-env";

test.describe("the API auth boundary", () => {
  test("rejects an unauthenticated request to a protected endpoint", async ({ request }) => {
    const response = await request.get("/api/tickets");

    expect(response.status()).toBe(401);
  });

  test("refuses an existing ticket's detail, body included, to a request with no session", async ({
    request,
    playwright,
  }) => {
    // The bare request fixture: this describe sets no storageState, so it carries no cookie.
    // The webhook needs none — its bearer secret is the only credential in play.
    const tag = uniqueTag();
    const id = await createTicketByEmail(request, {
      from: `auth.detail.${tag}@example.com`,
      subject: `Auth detail e2e ${tag}`,
      text: "Must not be readable without a session.",
    });

    const anonymous = await request.get(`/api/tickets/${id}`);
    expect(anonymous.status(), "no session").toBe(401);

    // Control: the same ticket with a session answers 200, so the 401 above is the auth
    // boundary refusing a real ticket rather than anything that would refuse everyone.
    const admin = await adminApiContext(playwright);
    const signedIn = await admin.get(`/api/tickets/${id}`);
    await admin.dispose();

    expect(signedIn.status(), "with the admin's session").toBe(200);
  });

  test("refuses sign-up even though the endpoint is mounted", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      headers: ORIGIN_HEADERS,
      data: {
        email: "intruder@e2e.test",
        password: "intruder-password",
        name: "Intruder",
      },
    });

    expect(response.ok()).toBe(false);

    // And no account was created as a side effect: signing in as them fails too.
    resetRateLimits();
    const signIn = await postSignIn(request, {
      email: "intruder@e2e.test",
      password: "intruder-password",
    });

    expect(signIn.ok()).toBe(false);
  });

  test("throttles repeated sign-in attempts from one client", async ({ request }) => {
    // postSignIn, not signInThroughApi: this test exists to exhaust the budget, so it has
    // to drive the endpoint without a rate-limit reset in front of every call.
    resetRateLimits();

    const statuses: number[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postSignIn(request, {
        email: ADMIN.email,
        password: "definitely-not-the-password",
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

    test("is refused the admin-only user directory, which AdminRoute only hides", async ({
      page,
      playwright,
    }) => {
      // AdminRoute redirects the agent's browser away from /users, but that is a rendering
      // decision. The boundary is requireRole on the router, and only a direct call with a
      // real agent cookie can show it holding.
      const asAgent = await page.request.get("/api/users");

      expect(asAgent.status()).toBe(403);

      // The same endpoint with an admin cookie answers 200. Without this half, the test
      // would still pass if /api/users were unmounted or broken for everyone.
      const adminContext = await adminApiContext(playwright);
      const asAdmin = await adminContext.get("/api/users");

      expect(asAdmin.status()).toBe(200);
      await adminContext.dispose();
    });
  });
});
