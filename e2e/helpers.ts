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
import { BASE_URL, INBOUND_EMAIL_SECRET, STORAGE_STATE } from "./test-env";

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
 * A test id that predates this module (client/src/components/users/UserRow.tsx). A row is an
 * `li` with no accessible name of its own — its name, email, role and Joined date are
 * separate children — so there is no role or text that names the row itself rather than
 * something inside it.
 */
export const userRows = (page: Page): Locator => page.getByTestId("user-row");

/** The /tickets page heading — by role, so the navbar link of the same name cannot match. */
export const ticketsHeading = (page: Page): Locator =>
  page.getByRole("heading", { name: "Tickets", exact: true });

/** The navbar link to /tickets, rendered for every signed-in user (client/src/components/Navbar.tsx). */
export const ticketsLink = (page: Page): Locator =>
  page.getByRole("link", { name: "Tickets", exact: true });

/**
 * The body rows of the ticket list, in rendered order, each carrying `data-ticket-id`.
 *
 * The test id is the application's (client/src/components/tickets/TicketsTable.tsx).
 * `getByRole("row")` would also match the header row, and the id attribute beside the test id
 * is the only thing that ties a row to the ticket id an API call returned.
 */
export const ticketRows = (page: Page): Locator => page.getByTestId("ticket-row");

/**
 * One of the /tickets filters: the "Status" or "Category" toggle group
 * (client/src/components/tickets/TicketFilters.tsx). Its options are buttons carrying
 * `aria-pressed`, so a caller asserts which one is chosen with toHaveAttribute.
 */
export const ticketFilter = (page: Page, name: "Status" | "Category"): Locator =>
  page.getByRole("group", { name, exact: true });

/**
 * The ids of the ticket rows a user can actually see, sorted, optionally only rows whose text
 * contains `containing` (a spec's tag). Reads once without waiting, so pass it to expect.poll.
 *
 * Visible, not merely present: the list groups rows into status sections that collapse with
 * `hidden`, leaving their rows in the DOM. Sorted, because the specs using this assert which
 * rows a filter or search leaves, not their order.
 */
export function shownTicketIds(page: Page, containing?: string): Promise<string[]> {
  const rows = containing ? ticketRows(page).filter({ hasText: containing }) : ticketRows(page);

  return rows.evaluateAll((elements) =>
    elements
      .filter((row) => row.checkVisibility())
      .map((row) => row.getAttribute("data-ticket-id") ?? "")
      .sort(),
  );
}

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
// Inbound email
// ---------------------------------------------------------------------------

/** The Authorization header POST /api/webhooks/inbound-email checks. */
export const bearerHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

/**
 * POSTs an email to the inbound webhook the way a mail provider would, with no Origin header.
 * Defaults to the harness's real secret; pass `headers` to send another.
 *
 * The webhook authenticates by the bearer secret alone. A test proving that — that a wrong
 * secret is refused — must pass a context with no session, and the `request` fixture only
 * is one outside a `test.use({ storageState })` block: Playwright hands that option to the
 * fixture as well as to the page.
 *
 * Returns the response and asserts nothing, so a caller can expect a 201, a duplicate's 200,
 * a 401 or a 413 as the behaviour it is testing demands.
 */
export function postInboundEmail(
  request: APIRequestContext,
  email: Record<string, string>,
  headers: Record<string, string> = bearerHeaders(INBOUND_EMAIL_SECRET),
): Promise<APIResponse> {
  return request.post("/api/webhooks/inbound-email", { data: email, headers });
}

/**
 * Sends `email` through the webhook with the real secret and returns the new ticket's id.
 * For tests that need a ticket to exist rather than tests of the webhook itself, so it fails
 * the test unless the email became a new ticket.
 */
export async function createTicketByEmail(
  request: APIRequestContext,
  email: Record<string, string>,
): Promise<string> {
  const response = await postInboundEmail(request, email);

  expect(
    response.status(),
    `expected the webhook to turn "${email.subject}" into a new ticket`,
  ).toBe(201);

  return ((await response.json()) as { id: string }).id;
}

/**
 * Unique across tests, retries and runs against a database that was not reset. Tickets have
 * no delete endpoint, so a spec that creates them tags its subjects with this and only ever
 * looks for its own rows.
 */
export const uniqueTag = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------------------
// Tickets through the API
// ---------------------------------------------------------------------------

/** The stored enum values (core/constants/ticket.ts), retyped: e2e does not import app code. */
export type TicketStatusValue = "OPEN" | "RESOLVED" | "CLOSED";
export type TicketCategoryValue = "GENERAL_QUESTION" | "TECHNICAL_QUESTION" | "REFUND_REQUEST";

/**
 * Creates a ticket with POST /api/tickets on `api` (a signed-in context such as
 * adminApiContext), then PATCHes it to `status` unless that is the default OPEN. The webhook
 * cannot set a category or a status, so this is how a spec builds a mixed set.
 *
 * Setup rather than behaviour under test: it fails the test, naming the subject, unless both
 * calls succeed, and returns the new id.
 */
export async function createTicketByApi(
  api: APIRequestContext,
  ticket: {
    subject: string;
    requesterEmail: string;
    category: TicketCategoryValue;
    status: TicketStatusValue;
  },
): Promise<string> {
  const { subject, requesterEmail, category, status } = ticket;

  const created = await api.post("/api/tickets", {
    data: { subject, requesterEmail, category, body: `Created by an E2E spec: ${subject}` },
  });
  expect(created.status(), `expected to create "${subject}"`).toBe(201);
  const { id } = (await created.json()) as { id: string };

  if (status !== "OPEN") {
    const patched = await api.patch(`/api/tickets/${id}`, { data: { status } });
    expect(patched.status(), `expected to move "${subject}" to ${status}`).toBe(200);
  }

  return id;
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
