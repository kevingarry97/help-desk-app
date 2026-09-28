import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { adminApiContext, createTicketByApi, createTicketByEmail, uniqueTag } from "../helpers";
import { AGENT, STORAGE_STATE } from "../test-env";

/**
 * Replying to a ticket. Component tests (TicketConversation.test.tsx) already cover the thread
 * as it renders, the composer's toggle, its validation copy, its error and in-flight states and
 * the exact body each button posts — all against a mocked axios. None of that touches a session
 * cookie, POST /api/tickets/:id/replies, or Postgres.
 *
 * What is here, and why each needs the real stack:
 *
 *   - A reply typed in the browser surviving a reload. A new document has an empty query cache,
 *     so the only way the text comes back is out of the database.
 *   - The route being open to agents. Every other write on a ticket (PATCH /:id, PATCH
 *     /:id/assignee) is requireRole(Role.Admin); only a real agent cookie against the running
 *     server shows that this one is not — and that "Reply & resolve" is therefore the one status
 *     change an agent can make, which the same test proves by having that agent's PATCH refused.
 *   - The transaction: the reply and the RESOLVED status must both land, which is a claim about
 *     one database write, not about anything rendered.
 *   - `isInternal` round-tripping, and the author being taken from the session rather than the
 *     request body — a mocked API cannot refuse a forged authorName, a real one can.
 *   - The refusals writing nothing. A 400 or a 401 that still inserted a row would look
 *     identical to the caller; only a follow-up read can tell them apart.
 *
 * Not covered here: `TicketReply.authorId onDelete: SetNull`. A reply is signed by whoever the
 * session says, so proving it needs a *throwaway* account's session, and this suite's rule is
 * saved storage state only — Better Auth's 3-sign-ins-per-10s counters are shared by every spec.
 * The schema and migration hold that behaviour; nothing in E2E asserts it.
 *
 * Every ticket below is created by this spec and carried by its own tag: the database resets
 * once per run, not per test, and a status section shows only its first 10 rows.
 */

type Reply = {
  id: string;
  body: string;
  isInternal: boolean;
  authorName: string;
  author: { id: string; name: string; email: string } | null;
};

type Detail = { id: string; status: string; replies: Reply[] };

/** POST /api/tickets/:id/replies on `api`, asserting nothing — callers expect 201, 400, 404 or 401. */
function postReply(api: APIRequestContext, ticketId: string, data: Record<string, unknown>) {
  return api.post(`/api/tickets/${ticketId}/replies`, { data });
}

/** GET /api/tickets/:id, failing the test unless it answers, so callers can read the thread. */
async function readTicket(api: APIRequestContext, ticketId: string): Promise<Detail> {
  const response = await api.get(`/api/tickets/${ticketId}`);

  expect(response.status(), `GET /api/tickets/${ticketId}`).toBe(200);

  return (await response.json()) as Detail;
}

/** The thread inside the open detail sheet: `<section aria-labelledby>` headed "Conversation". */
const conversation = (page: Page, subject: string): Locator =>
  page.getByRole("dialog", { name: subject }).getByRole("region", { name: "Conversation" });

/** The composer's box — the only textbox in the thread; its label is sr-only. */
const composer = (thread: Locator): Locator => thread.getByRole("textbox");

/** Resolves once the browser's own POST of a reply has answered. Register it before the click. */
const replyPosted = (page: Page, ticketId: string) =>
  page.waitForResponse(
    (response) =>
      response.url().includes(`/api/tickets/${ticketId}/replies`) &&
      response.request().method() === "POST",
  );

test.describe("replying with no session", () => {
  // No storageState in this describe, so the `request` fixture carries no cookie either.
  test("a reply posted without a session is refused, and nothing is written", async ({
    request,
    playwright,
  }) => {
    const tag = uniqueTag();
    // The webhook, not the ticket API: creating the ticket must not need the session this
    // test is proving is absent.
    const id = await createTicketByEmail(request, {
      from: `reply.anon.${tag}@example.com`,
      subject: `Reply auth e2e ${tag}`,
      text: "Nobody signed in may answer this.",
    });

    const anonymous = await postReply(request, id, {
      body: `Forged reply ${tag}`,
      isInternal: false,
    });
    expect(anonymous.status(), "POST a reply with no session").toBe(401);

    // Read it back with a session: a 401 that had still inserted the row would be invisible
    // from the refused call alone.
    const api = await adminApiContext(playwright);

    try {
      const ticket = await readTicket(api, id);
      expect(ticket.replies, "the refused reply stored nothing").toEqual([]);
    } finally {
      await api.dispose();
    }
  });
});

test.describe("replying to a ticket, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("a reply an agent sends is still in the thread after a reload", async ({ page }) => {
    const tag = uniqueTag();
    const subject = `Reply e2e ${tag}`;
    const body = `Reset link sent again, run ${tag}.`;

    // page.request carries the browser's own agent cookie; POST /api/tickets has no role guard.
    const id = await createTicketByApi(page.request, {
      subject,
      requesterEmail: `reply.${tag}@example.com`,
      category: "TECHNICAL_QUESTION",
      status: "OPEN",
    });

    // Searched down to this run's ticket: a status section pages at 10, and the tickets other
    // specs leave behind would otherwise push this one off the first page.
    await page.goto(`/tickets?q=${tag}`);
    await page.getByRole("link", { name: subject }).click();
    await expect(page).toHaveURL(`/tickets/${id}?q=${tag}`);

    const thread = conversation(page, subject);
    await composer(thread).fill(body);

    // Registered before the click: the reload below must not race the write it depends on.
    const posted = replyPosted(page, id);
    await thread.getByRole("button", { name: "Send reply" }).click();

    expect(
      (await posted).status(),
      "the agent's reply was accepted — this route carries no admin guard",
    ).toBe(201);
    await expect(thread.getByText(body, { exact: true })).toBeVisible();

    await page.reload();

    // New document, new query cache, no component state: this can only have come back from
    // GET /api/tickets/:id, which means the typed reply reached Postgres.
    await expect(
      conversation(page, subject).getByText(body, { exact: true }),
      "the reply is still in the thread after the reload",
    ).toBeVisible();
  });

  test("Reply & resolve stores the reply and moves the ticket to Resolved", async ({ page }) => {
    const tag = uniqueTag();
    const subject = `Reply resolve e2e ${tag}`;
    const body = `Refund processed, run ${tag}.`;

    const id = await createTicketByApi(page.request, {
      subject,
      requesterEmail: `reply.resolve.${tag}@example.com`,
      category: "REFUND_REQUEST",
      status: "OPEN",
    });

    // The premise: this agent has no other way to move the ticket, so the status below can
    // only have come from the reply route.
    const refused = await page.request.patch(`/api/tickets/${id}`, {
      data: { status: "RESOLVED" },
    });
    expect(refused.status(), "an agent's PATCH of the status").toBe(403);
    expect((await readTicket(page.request, id)).status, "still open after the refusal").toBe(
      "OPEN",
    );

    await page.goto(`/tickets?q=${tag}`);
    await page.getByRole("link", { name: subject }).click();

    const thread = conversation(page, subject);
    await composer(thread).fill(body);

    const posted = replyPosted(page, id);
    await thread.getByRole("button", { name: "Reply & resolve" }).click();
    expect((await posted).status(), "the agent's reply-and-resolve").toBe(201);

    // Read back from the server, not the sheet: the claim is that one transaction wrote both,
    // so a resolved ticket with no reply — or a reply with the status untouched — must fail.
    const ticket = await readTicket(page.request, id);
    expect(ticket.status, "the ticket was resolved by the reply").toBe("RESOLVED");
    expect(
      ticket.replies.map((reply) => reply.body),
      "and the reply that resolved it was stored",
    ).toEqual([body]);
  });

  test("a note stays internal, a reply stays public, and both are signed by the session", async ({
    request,
  }) => {
    const tag = uniqueTag();
    const published = `Public answer ${tag}`;
    const note = `Team only ${tag}`;

    const id = await createTicketByApi(request, {
      subject: `Reply flags e2e ${tag}`,
      requesterEmail: `reply.flags.${tag}@example.com`,
      category: "GENERAL_QUESTION",
      status: "OPEN",
    });

    const first = await postReply(request, id, { body: published, isInternal: false });
    expect(first.status(), "the public reply").toBe(201);

    // Both author fields are forged in the body. The route takes them from req.user instead,
    // so a reply cannot be signed as someone else.
    const second = await postReply(request, id, {
      body: note,
      isInternal: true,
      authorName: "Someone Else",
      authorId: "not-a-real-user-id",
    });
    expect(second.status(), "the internal note").toBe(201);

    const { replies } = await readTicket(request, id);

    expect(
      Object.fromEntries(replies.map((reply) => [reply.body, reply.isInternal])),
      "each reply kept the flag its caller chose",
    ).toEqual({ [published]: false, [note]: true });

    const forged = replies.find((reply) => reply.body === note)!;
    expect(forged.authorName, "the snapshotted name is the session's, not the body's").toBe(
      AGENT.name,
    );
    expect(forged.author, "and so is the linked account").toMatchObject({ email: AGENT.email });
  });

  test("an empty reply and an unknown ticket are refused, and neither writes anything", async ({
    request,
  }) => {
    const tag = uniqueTag();
    const id = await createTicketByApi(request, {
      subject: `Reply refusals e2e ${tag}`,
      requesterEmail: `reply.refusals.${tag}@example.com`,
      category: "GENERAL_QUESTION",
      status: "OPEN",
    });

    // Whitespace as well as empty: the server trims before it measures, and it is the boundary
    // — the form's own check never runs for a caller that is not the form.
    for (const body of ["", "   "]) {
      const response = await postReply(request, id, { body, isInternal: false });

      expect(response.status(), `a reply whose body is ${JSON.stringify(body)}`).toBe(400);
      expect(await response.json()).toMatchObject({ error: "Invalid request body" });
    }

    const missingId = `no-such-ticket-${tag}`;
    const missing = await postReply(request, missingId, {
      body: `Reply to nothing ${tag}`,
      isInternal: false,
    });
    expect(missing.status(), "a reply onto a ticket that does not exist").toBe(404);

    const unchanged = await request.get(`/api/tickets/${missingId}`);
    expect(unchanged.status(), "and no ticket was conjured to hold it").toBe(404);

    // The control: a valid reply on the same ticket is accepted, so the 400s above are this
    // body being refused rather than the route being broken for everyone.
    const accepted = await postReply(request, id, {
      body: `Written after the refusals ${tag}`,
      isInternal: false,
    });
    expect(accepted.status(), "a reply with a body").toBe(201);

    expect(
      (await readTicket(request, id)).replies.map((reply) => reply.body),
      "only the accepted reply was stored",
    ).toEqual([`Written after the refusals ${tag}`]);
  });
});
