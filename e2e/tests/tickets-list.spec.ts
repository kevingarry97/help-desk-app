import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  createTicketByEmail,
  expectOnDashboard,
  ticketRows,
  ticketsHeading,
  ticketsLink,
  uniqueTag,
} from "../helpers";
import { STORAGE_STATE } from "../test-env";

/**
 * The ticket list as an agent reaches it: through the real router from the navbar, and filled
 * by tickets that arrived through the inbound email webhook. Component tests cover how the
 * page renders a list they hand it; only the full stack shows that a ticket a mail provider
 * posted is in that list for an agent's session, in the order the server sorted it and the
 * table kept.
 *
 * Tickets have no delete endpoint and the database resets once per run, not per test, so the
 * tickets made here stay, and other specs leave theirs. Nothing below assumes the table holds
 * only this test's rows: they are found by a unique subject and compared by id.
 */

type EmailedTicket = { id: string; subject: string; requesterEmail: string };

/** Sends one email through the webhook and fails the test unless it became a ticket. */
async function emailTicket(
  request: APIRequestContext,
  label: "older" | "newer",
  tag: string,
): Promise<EmailedTicket> {
  const subject = `List e2e ${label} ${tag}`;
  const requesterEmail = `list.${label}.${tag}@example.com`;

  const id = await createTicketByEmail(request, {
    from: requesterEmail,
    subject,
    text: `The ${label} of two emails sent by the ticket list spec.`,
  });

  return { id, subject, requesterEmail };
}

/** Each row's ticket id and Received timestamp, top to bottom. Reads once; does not wait. */
function readRows(page: Page) {
  return ticketRows(page).evaluateAll((rows) =>
    rows.map((row) => ({
      id: row.getAttribute("data-ticket-id"),
      receivedAt: row.querySelector("time")?.getAttribute("datetime") ?? null,
    })),
  );
}

test.describe("the ticket list, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("is reached from the dashboard through the navbar Tickets link", async ({ page }) => {
    await page.goto("/");
    await expectOnDashboard(page);

    // Asserted before the click so a missing link fails here, naming the cause, rather than
    // as a click that waits out the test timeout.
    await expect(ticketsLink(page), "an agent should be offered the Tickets link").toBeVisible();
    await ticketsLink(page).click();

    await expect(page).toHaveURL(/\/tickets$/);
    await expect(ticketsHeading(page)).toBeVisible();
  });

  test("shows tickets that arrived by email, newest first", async ({ page, request }) => {
    const tag = uniqueTag();

    // Sequential on purpose: the second POST is only sent once the first ticket is stored.
    const older = await emailTicket(request, "older", tag);
    const newer = await emailTicket(request, "newer", tag);

    await page.goto("/tickets");
    await expect(ticketsHeading(page)).toBeVisible();

    // Each ticket is on screen with what the email said, and the row showing it is the one
    // the webhook created, not a lookalike.
    for (const ticket of [older, newer]) {
      const row = ticketRows(page).filter({ hasText: ticket.subject });

      await expect(row, `expected a row for "${ticket.subject}"`).toBeVisible();
      await expect(row).toContainText(ticket.requesterEmail);
      await expect(row).toHaveAttribute("data-ticket-id", ticket.id);
    }

    // Both rows are rendered, so the list is loaded and this single read is not racing it.
    const rows = await readRows(page);
    const receivedAt = (id: string) =>
      Date.parse(rows.find((row) => row.id === id)?.receivedAt ?? "");

    // The premise, checked rather than assumed. If the two shared a millisecond, the server's
    // `id` tiebreak alone would decide their order, and the test would no longer be about
    // createdAt at all.
    expect(
      receivedAt(newer.id),
      "the second email should have been stored with a later timestamp than the first",
    ).toBeGreaterThan(receivedAt(older.id));

    const ours = rows.map((row) => row.id).filter((id) => id === older.id || id === newer.id);
    expect(ours, "the newer ticket's row should come before the older one's").toEqual([
      newer.id,
      older.id,
    ]);

    // With one worker nothing else creates a ticket between the POSTs above and this page
    // load, so the newest ticket in the whole table is this test's. The list is grouped by
    // status with Open first, and an emailed ticket is open, so it heads that first section.
    await expect(
      ticketRows(page).first(),
      "the most recently emailed ticket should head the list",
    ).toHaveAttribute("data-ticket-id", newer.id);
  });
});
