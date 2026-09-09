import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Cookie,
  type Locator,
  type Page,
  type PlaywrightWorkerArgs,
} from "@playwright/test";

import { resetRateLimits } from "./reset-rate-limits";
import { BASE_URL, STORAGE_STATE } from "./test-env";

/**
 * Shared vocabulary for the specs in e2e/tests. Two rules for anything added here:
 *
 * 1. Assertion helpers must assert at least as much as the line they replace, and carry a
 *    message so a failure names the behaviour rather than a line inside this file.
 * 2. Locator helpers return a Locator and assert nothing, so the assertion stays visible in
 *    the test that cares about it.
 *
 * Configuration (ports, credentials, storage-state paths) belongs in test-env.ts — it is
 * imported by playwright.config.ts and must stay free of Playwright runtime code.
 */

/** The shape Better Auth's email sign-in endpoint takes. ADMIN and AGENT satisfy it. */
export type Credentials = { email: string; password: string };

/**
 * Better Auth checks Origin against its trusted list on state-changing requests, and the
 * bare `request` fixture sends none. Derived from BASE_URL rather than written out, so
 * changing CLIENT_PORT in test-env.ts cannot strand a literal here and turn every API auth
 * test into a confusing 403.
 */
export const ORIGIN_HEADERS = { origin: BASE_URL } as const;

/** Better Auth prefixes its cookie name, so matches are by substring. */
export const SESSION_COOKIE = "session_token";

// ---------------------------------------------------------------------------
// Locators
// ---------------------------------------------------------------------------

/** The dashboard heading, "Welcome back, {name}" (client/src/pages/HomePage.tsx). */
export const dashboardHeading = (page: Page): Locator =>
  page.getByRole("heading", { level: 1 });

/** The /users page heading — by role, so the navbar link of the same name cannot match. */
export const usersHeading = (page: Page): Locator =>
  page.getByRole("heading", { name: "Users" });

/** The navbar link to /users, rendered only for admins (client/src/components/Navbar.tsx). */
export const usersLink = (page: Page): Locator => page.getByRole("link", { name: "Users" });

/** The navbar sign-out button. Present for every signed-in user. */
export const signOutButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Sign out" });

/**
 * The rows of the user directory.
 *
 * The one test id in the suite, and it predates this module (client/src/components/users/
 * UserRow.tsx). A row is an `li` with no accessible name of its own — its name, email, role
 * and Joined date are separate children — so there is no role or text that names the row
 * itself rather than something inside it.
 */
export const userRows = (page: Page): Locator => page.getByTestId("user-row");

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const expectDashboard = expect.configure({
  message: "expected the dashboard to be showing",
});

const expectLogin = expect.configure({
  message: "expected to be on /login",
});

/**
 * The session reached the dashboard.
 *
 * Asserts the heading only. Callers that also care *how* they got here — a reload, a bounce
 * off /users, a post-sign-in redirect — assert the URL themselves, because that assertion is
 * the point of those tests and does not belong buried in a helper.
 */
export async function expectOnDashboard(page: Page): Promise<void> {
  await expectDashboard(dashboardHeading(page)).toContainText("Welcome back");
}

/**
 * The browser is sitting on /login — bounced there by a route guard, left there by a failed
 * sign-in, or sent there by sign-out.
 *
 * Asserts the URL only. The two callers that also want the form on screen assert that
 * separately, so this helper is never the sole evidence that a redirect happened.
 */
export async function expectOnLogin(page: Page): Promise<void> {
  await expectLogin(page).toHaveURL(/\/login$/);
}

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

/**
 * POSTs credentials to Better Auth. Returns the response; asserts nothing and resets
 * nothing, so a spec testing the rate limiter can drive it directly.
 */
export function postSignIn(
  request: APIRequestContext,
  credentials: Credentials,
): Promise<APIResponse> {
  return request.post("/api/auth/sign-in/email", {
    headers: ORIGIN_HEADERS,
    data: credentials,
  });
}

/**
 * Signs in by driving the real login form.
 *
 * COST: one of Better Auth's three sign-ins per 10s per IP. The counters are persisted in
 * Postgres and every spec shares 127.0.0.1, so this clears them first — a caller cannot 429
 * on budget someone else spent. That safety is not permission: each call is a real
 * credential exchange plus a spawned `bun prisma/test-db.ts` process, and per
 * e2e/tests/README.md only login-redirect.spec.ts should be doing this at all. Everything
 * else takes a saved session via STORAGE_STATE.
 *
 * Does not navigate and does not assert the outcome — callers arrive from the URL they are
 * testing and assert whether they landed or were refused.
 */
export async function signInThroughForm(
  page: Page,
  credentials: Credentials,
): Promise<void> {
  resetRateLimits();

  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Mints a session directly into `context`'s cookie jar, skipping the form.
 *
 * COST: the same three-per-10s budget and the same reset as signInThroughForm. For specs
 * that need a *throwaway* session: signing out revokes the token inside a STORAGE_STATE
 * file for every later spec that shares it.
 *
 * Fails the test if the sign-in did not succeed, so a broken fixture surfaces here rather
 * than as an unexplained missing element later.
 */
export async function signInThroughApi(
  context: BrowserContext,
  credentials: Credentials,
): Promise<void> {
  resetRateLimits();

  const response = await postSignIn(context.request, credentials);

  expect(response.ok(), `failed to mint a session for ${credentials.email}`).toBe(true);
}

// ---------------------------------------------------------------------------
// API contexts
// ---------------------------------------------------------------------------

/**
 * A request context carrying the admin's saved session, for the half of a test that has to
 * call an endpoint the browser under test is not allowed to reach.
 *
 * Costs no sign-in budget — it replays the cookie global setup already minted. `baseURL` is
 * set here because a context created without one rejects the relative paths every caller
 * writes, with an error that reads like a bad path rather than a missing option.
 */
export function adminApiContext(
  playwright: PlaywrightWorkerArgs["playwright"],
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: BASE_URL,
    storageState: STORAGE_STATE.admin,
  });
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

/**
 * The session cookie in `context`, asserted to exist so callers get a definite Cookie.
 * `message` is the caller's, so a failure says why that test wanted the cookie.
 */
export async function requireSessionCookie(
  context: BrowserContext,
  message: string,
): Promise<Cookie> {
  const cookie = (await context.cookies()).find((c) => c.name.includes(SESSION_COOKIE));

  expect(cookie, message).toBeTruthy();

  return cookie!;
}
