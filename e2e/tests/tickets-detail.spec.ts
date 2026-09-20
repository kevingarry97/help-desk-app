import { expect, test } from "@playwright/test";

import {
  createTicketByEmail,
  expectOnDashboard,
  ticketFilter,
  ticketRows,
  uniqueTag,
} from "../helpers";
import { STORAGE_STATE } from "../test-env";

test.describe("a ticket's detail, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("opens in a sheet over the list from a click anywhere on its row, showing the stored body", async ({
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

    const position = { x: rowBox.width - 12, y: rowBox.height / 2 };
    expect(
      rowBox.x + position.x,
      "the click must land on the row outside the subject link's own box",
    ).toBeGreaterThan(linkBox.x + linkBox.width);

    await row.click({ position });

    await expect(page).toHaveURL(`/tickets/${id}`);

    const sheet = page.getByRole("dialog", { name: subject });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(body, { exact: true })).toBeVisible();

    await expect(row, "the list stays mounted behind the sheet").toBeAttached();
  });

  test("closes back to the exact filtered, sorted list, and Back then leaves the list", async ({
    page,
    request,
  }) => {
    const tag = uniqueTag();
    const subject = `Detail close e2e ${tag}`;
    const id = await createTicketByEmail(request, {
      from: `detail.close.${tag}@example.com`,
      subject,
      text: "Opened from a filtered, sorted list.",
    });

    const query = "?status=OPEN&sort=subject&dir=asc";
    const list = `/tickets${query}`;

    await page.goto("/");
    await expectOnDashboard(page);
    await page.goto(list);

    await page.getByRole("link", { name: subject }).click();

    await expect(page).toHaveURL(`/tickets/${id}${query}`);
    const sheet = page.getByRole("dialog", { name: subject });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: "Close" }).click();

    await expect(page).toHaveURL(list);
    await expect(
      ticketFilter(page, "Status").getByRole("button", { name: "Open", exact: true }),
      "the list is showing the filter it was left on",
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog"), "the sheet is gone").toHaveCount(0);

    await page.goBack();

    await expect(page).toHaveURL("/");
    await expectOnDashboard(page);
  });

  test("opens straight from a link, and closing lands on that link's filtered list", async ({
    page,
    request,
  }) => {
    const tag = uniqueTag();
    const subject = `Detail link e2e ${tag}`;
    const id = await createTicketByEmail(request, {
      from: `detail.link.${tag}@example.com`,
      subject,
      text: "Opened from a pasted link.",
    });

    await page.goto(`/tickets/${id}?status=OPEN`);

    const sheet = page.getByRole("dialog", { name: subject });
    await expect(sheet).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page).toHaveURL("/tickets?status=OPEN");
    await expect(
      ticketFilter(page, "Status").getByRole("button", { name: "Open", exact: true }),
      "the list is showing the link's filter",
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog"), "the sheet is gone").toHaveCount(0);
  });

  test("names the sheet Ticket not found for an id that does not exist", async ({ page }) => {
    await page.goto(`/tickets/no-such-ticket-${uniqueTag()}`);

    await expect(page.getByRole("dialog", { name: "Ticket not found" })).toBeVisible();
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

    const missing = await page.request.get(`/api/tickets/no-such-ticket-${tag}`);
    expect(missing.status(), "an id with no ticket").toBe(404);
  });
});
