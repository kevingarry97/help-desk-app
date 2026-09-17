import { expect, test, type PlaywrightWorkerArgs } from "@playwright/test";

import { adminApiContext, bearerHeaders, postInboundEmail, uniqueTag } from "../helpers";
import { INBOUND_EMAIL_SECRET } from "../test-env";

/**
 * The inbound email webhook end to end: a server-to-server POST creates a ticket that a
 * signed-in user reads back through GET /api/tickets. The read-back here goes through the API
 * with the admin's saved session, because what these tests assert is what was stored — the
 * status enum, the normalised address, how many rows — and the shape of the list response
 * itself. The same tickets reaching the list page is tickets-list.spec.ts; an emailed body
 * read back in full through GET /api/tickets/:id is tickets-detail.spec.ts.
 *
 * How an email is parsed (address extraction, fallbacks, bracket stripping, body
 * normalisation and truncation) is unit-tested in server/src/lib/inbound-email.test.ts. This
 * spec covers what those tests cannot reach: the secret coming from the harness env, the
 * router sitting above the app-wide express.json() (so a large email is not refused with a
 * 413), the guard on the real route, the write to Postgres, the unique index on messageId,
 * and the ticket showing up for a session without its body.
 *
 * Tickets have no delete endpoint and the database resets once per run, not per test, so
 * nothing here is cleaned up. Each test tags its subject and Message-ID uniquely, and only
 * ever looks for its own rows.
 */

/** express.json()'s default limit, the one the app-wide parser in server/src/index.ts uses. */
const APP_JSON_LIMIT_BYTES = 100 * 1024;

/** The fields of a GET /api/tickets row this spec reads (ticketListItemSchema in core). */
type Ticket = {
  id: string;
  subject: string;
  requesterEmail: string;
  status: string;
};

/** Every ticket, as the admin sees it. Fails the test if the list did not load. */
async function readTickets(playwright: PlaywrightWorkerArgs["playwright"]): Promise<Ticket[]> {
  const admin = await adminApiContext(playwright);

  try {
    const response = await admin.get("/api/tickets");
    expect(response.status(), "expected a signed-in admin to read GET /api/tickets").toBe(200);

    const tickets: unknown = await response.json();
    expect(Array.isArray(tickets), "expected GET /api/tickets to answer an array").toBe(true);

    return tickets as Ticket[];
  } finally {
    await admin.dispose();
  }
}

test.describe("the inbound email webhook", () => {
  test("turns an email sent with the secret into an open ticket a signed-in user can read", async ({
    request,
    playwright,
  }) => {
    const tag = uniqueTag();
    const subject = `Inbound e2e ${tag}`;

    const response = await postInboundEmail(request, {
      from: `Inbound Requester <Requester.${tag}@Example.COM>`,
      subject,
      text: `Sent through the webhook by run ${tag}.`,
      messageId: `<inbound-read-${tag}@mail.e2e.test>`,
    });

    expect(response.status()).toBe(201);
    const { id } = (await response.json()) as { id: string };

    const ticket = (await readTickets(playwright)).find((t) => t.id === id);

    expect(ticket, `expected ticket ${id} in GET /api/tickets`).toMatchObject({
      subject,
      requesterEmail: `requester.${tag}@example.com`,
      status: "OPEN",
    });

    // The list's contract (TICKET_LIST_SELECT): an emailed body runs to 50,000 characters and
    // the Message-ID is de-duplication plumbing, so neither is shipped with a listed ticket.
    // Both columns are non-null on this row. The row was found above, so these absences are
    // read from a ticket that is really there, not from a lookup that came back empty.
    expect(ticket, "a listed ticket must not carry its body").not.toHaveProperty("body");
    expect(ticket, "a listed ticket must not carry its messageId").not.toHaveProperty(
      "messageId",
    );
  });

  test("accepts an email larger than the app-wide JSON limit, because the webhook parses its own body", async ({
    request,
    playwright,
  }) => {
    const tag = uniqueTag();
    const subject = `Large inbound e2e ${tag}`;
    const email = {
      from: `large.${tag}@example.com`,
      subject,
      text: `Large email ${tag}\n${"x".repeat(300_000)}`,
    };

    // The premise, checked rather than assumed: a later edit that shrinks the text below the
    // global parser's limit would otherwise leave this passing without testing mount order.
    expect(
      Buffer.byteLength(JSON.stringify(email)),
      "the request body must exceed the app-wide express.json() limit",
    ).toBeGreaterThan(APP_JSON_LIMIT_BYTES * 2);

    // A 413 here means the app-wide express.json() read the body before the webhook router,
    // which only happens if the router is mounted below it in server/src/index.ts.
    const response = await postInboundEmail(request, email);
    expect(response.status(), "a ~300kb authorised email").toBe(201);
    const { id } = (await response.json()) as { id: string };

    // Stored, not just answered: the id the webhook returned lists with this email's subject.
    const ticket = (await readTickets(playwright)).find((t) => t.id === id);
    expect(ticket, `expected ticket ${id} in GET /api/tickets`).toMatchObject({ subject });
  });

  test("refuses a missing or wrong secret and stores nothing", async ({
    request,
    playwright,
  }) => {
    const tag = uniqueTag();
    const email = {
      from: `refused.${tag}@example.com`,
      subject: `Refused e2e ${tag}`,
      text: "Should never become a ticket.",
    };

    const missing = await postInboundEmail(request, email, {});
    const wrong = await postInboundEmail(
      request,
      email,
      bearerHeaders(`not-${INBOUND_EMAIL_SECRET}`),
    );

    expect(missing.status(), "no Authorization header").toBe(401);
    expect(wrong.status(), "wrong bearer secret").toBe(401);

    // readTickets has already asserted a 200 and an array, so this absence is read from a
    // list that actually loaded rather than from a failed or missing response.
    const refused = (await readTickets(playwright)).filter((t) => t.subject === email.subject);
    expect(refused).toEqual([]);

    // Control: the identical email with the right secret is found by the same lookup. Without
    // it, the absence above would also pass if the lookup could never match. Exactly one
    // means the two refused attempts left nothing behind.
    const accepted = await postInboundEmail(request, email);
    expect(accepted.status(), "the same email with the right secret").toBe(201);

    const stored = (await readTickets(playwright)).filter((t) => t.subject === email.subject);
    expect(stored).toHaveLength(1);
  });

  test("stores a redelivered email once, whether or not its Message-ID has brackets", async ({
    request,
    playwright,
  }) => {
    const tag = uniqueTag();
    const messageId = `inbound-${tag}@mail.e2e.test`;
    const email = {
      from: `redelivered.${tag}@example.com`,
      subject: `Redelivered e2e ${tag}`,
      text: "Delivered twice by the provider.",
    };

    const first = await postInboundEmail(request, { ...email, messageId: `<${messageId}>` });
    expect(first.status(), "first delivery").toBe(201);
    const { id } = (await first.json()) as { id: string };

    // The bare form must hit the row the bracketed form created. If brackets reached the
    // column, this would be a second 201 and a second ticket.
    const second = await postInboundEmail(request, { ...email, messageId });
    expect(second.status(), "redelivery").toBe(200);
    expect(await second.json()).toEqual({ id, duplicate: true });

    // The list does not carry messageId, so the two deliveries are found by the subject they
    // share, which is unique to this test. One row, and it is the first delivery's.
    const matching = (await readTickets(playwright)).filter((t) => t.subject === email.subject);
    expect(matching.map((t) => t.id)).toEqual([id]);
  });
});
