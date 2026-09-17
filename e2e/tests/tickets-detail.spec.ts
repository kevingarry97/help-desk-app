import { expect, test } from "@playwright/test";

import { createTicketByEmail, ticketFilter, ticketRows, uniqueTag } from "../helpers";
import { STORAGE_STATE } from "../test-env";

/**
 * One ticket, opened from the list. Component tests render the page from a mocked response
 * and check the router state the list hands over. Only the running stack shows a ticket that
 * arrived by email opening from a real click on its row (a stretched link, which depends on
 * real layout), the "All tickets" link carrying the filters back through the real router, and
 * the server's 404 reaching the page.
 *
 * Tickets have no delete endpoint and the database resets once per run, not per test, so
 * each test makes its own ticket with a unique subject and finds it by that.
 */

test.describe("a ticket's detail, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("opens from a click anywhere on its row, showing the stored subject and body", async ({
    page,
    request,
  }) => {
    const tag = uniqueTag();
    const subject = `Detail e2e ${tag}`;
    const body = `The stored body of the detail spec's ticket, run ${tag}.`;
    const id = await createTicketByEmail(request, {
      from: `detail.${tag}@example.com`,
      subject,
      text: body,
    });

    await page.goto("/tickets");

    const row = ticketRows(page).filter({ hasText: subject });
    await expect(row).toBeVisible();

    const rowBox = await row.boundingBox();
    const linkBox = await row.getByRole("link", { name: subject }).boundingBox();
    if (!rowBox || !linkBox) throw new Error("The ticket row or its subject link has no box.");

    // Near the row's right-hand edge, in the Received cell. The premise is checked rather than
    // assumed: a click on the subject text itself would pass without the stretched link.
    const position = { x: rowBox.width - 12, y: rowBox.height / 2 };
    expect(
      rowBox.x + position.x,
      "the click must land on the row outside the subject link's own box",
    ).toBeGreaterThan(linkBox.x + linkBox.width);

    await row.click({ position });

    await expect(page).toHaveURL(`/tickets/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(page.getByText(body, { exact: true })).toBeVisible();
  });

  test("returns through All tickets to the filtered list it was opened from", async ({
    page,
    request,
  }) => {
    const tag = uniqueTag();
    const subject = `Detail back e2e ${tag}`;
    // An emailed ticket is open and a general question, so it is listed under this filter.
    const filteredList = "/tickets?status=OPEN&category=GENERAL_QUESTION";
    const id = await createTicketByEmail(request, {
      from: `detail.back.${tag}@example.com`,
      subject,
      text: "Opened from a filtered list.",
    });

    await page.goto(filteredList);
    await page.getByRole("link", { name: subject }).click();

    await expect(page).toHaveURL(`/tickets/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();

    await page.getByRole("link", { name: "All tickets" }).click();

    await expect(page).toHaveURL(filteredList);
    await expect(
      ticketFilter(page, "Status").getByRole("button", { name: "Open", exact: true }),
      "the list is showing the filter it was left on",
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("shows Ticket not found for an id that does not exist", async ({ page }) => {
    await page.goto(`/tickets/no-such-ticket-${uniqueTag()}`);

    await expect(page.getByRole("heading", { name: "Ticket not found" })).toBeVisible();
  });

  test("the API serves a ticket with its body but not its messageId, and 404s an unknown id", async ({
    page,
    request,
  }) => {
    const tag = uniqueTag();
    const subject = `Detail API e2e ${tag}`;
    const text = `Read back in full by run ${tag}.`;
    const id = await createTicketByEmail(request, {
      from: `detail.api.${tag}@example.com`,
      subject,
      text,
      // Stored non-null, so a leak would show up as a value rather than a missing null.
      messageId: `<detail-api-${tag}@mail.e2e.test>`,
    });

    // page.request shares the page's context, so this is the agent's session.
    const found = await page.request.get(`/api/tickets/${id}`);
    expect(found.status(), "an existing ticket").toBe(200);

    const ticket: unknown = await found.json();
    expect(ticket).toMatchObject({
      id,
      subject,
      body: text,
      requesterEmail: `detail.api.${tag}@example.com`,
      status: "OPEN",
    });
    expect(ticket, "the detail must not carry the messageId").not.toHaveProperty("messageId");

    // Asked of the same route that just answered 200, so this 404 is the route's own answer
    // for a missing row and not Express's default for an unmounted path.
    const missing = await page.request.get(`/api/tickets/no-such-ticket-${tag}`);
    expect(missing.status(), "an id with no ticket").toBe(404);
  });
});
