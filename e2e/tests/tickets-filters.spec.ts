import { expect, test } from "@playwright/test";

import {
  adminApiContext,
  createTicketByApi,
  shownTicketIds,
  ticketFilter,
  uniqueTag,
  type TicketCategoryValue,
  type TicketStatusValue,
} from "../helpers";
import { STORAGE_STATE } from "../test-env";

/**
 * Filtering the ticket list by status and category. Component tests already show which
 * parameters the page sends and how it reads them back from the URL. What only the full
 * stack can show is the server's WHERE clause narrowing real rows by category, the filters
 * surviving a real reload because they live in the URL, and the API refusing a filter value
 * it does not know.
 *
 * Status is the exception. The list groups tickets into status sections in the browser and,
 * under a status filter, renders only that section — so a server that ignored `status` would
 * look identical here (checked: this spec stays green against one). The server's status
 * clause is proved on the response itself, in tickets-search.spec.ts.
 *
 * Four tickets are made once for the describe, one per combination the assertions need to
 * tell apart. Other specs leave tickets behind (the database resets once per run, not per
 * test), so every assertion reads only the rows carrying this run's tag.
 */

const sorted = (...ids: string[]) => [...ids].sort();

test.describe("filtering the ticket list, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  let tag = "";
  let openGeneral = "";
  let resolvedRefund = "";
  let resolvedTechnical = "";
  let closedRefund = "";

  test.beforeAll(async ({ playwright }) => {
    tag = uniqueTag();
    const api = await adminApiContext(playwright);

    const create = (category: TicketCategoryValue, status: TicketStatusValue) => {
      const label = `${status} ${category}`.toLowerCase();

      return createTicketByApi(api, {
        subject: `Filter e2e ${label} ${tag}`,
        requesterEmail: `filters.${tag}@example.com`,
        category,
        status,
      });
    };

    try {
      openGeneral = await create("GENERAL_QUESTION", "OPEN");
      resolvedRefund = await create("REFUND_REQUEST", "RESOLVED");
      resolvedTechnical = await create("TECHNICAL_QUESTION", "RESOLVED");
      // Matches the category chosen below but not the status, so it can only stay hidden if
      // both filters apply together rather than the second replacing the first.
      closedRefund = await create("REFUND_REQUEST", "CLOSED");
    } finally {
      await api.dispose();
    }
  });

  test("narrows the list to the chosen status, then to that status and category", async ({
    page,
  }) => {
    await page.goto("/tickets");

    // The premise: unfiltered, all four are listed, so each one that disappears below was
    // removed by a filter rather than never loaded.
    await expect
      .poll(() => shownTicketIds(page, tag), { message: "all four tickets listed before filtering" })
      .toEqual(sorted(openGeneral, resolvedRefund, resolvedTechnical, closedRefund));

    // Shown by the browser's status sections as much as by the server; see the header.
    await ticketFilter(page, "Status")
      .getByRole("button", { name: "Resolved", exact: true })
      .click();

    await expect
      .poll(() => shownTicketIds(page, tag), { message: "only the resolved tickets remain" })
      .toEqual(sorted(resolvedRefund, resolvedTechnical));

    // Only the server filters by category: the browser has no category grouping to fall
    // back on, so the technical question can only leave if the WHERE clause removed it.
    await ticketFilter(page, "Category")
      .getByRole("button", { name: "Refund request", exact: true })
      .click();

    await expect
      .poll(() => shownTicketIds(page, tag), {
        message: "only the resolved refund request remains",
      })
      .toEqual([resolvedRefund]);
  });

  test("keeps the chosen filters across a reload", async ({ page }) => {
    await page.goto("/tickets");
    await expect
      .poll(() => shownTicketIds(page, tag), { message: "all four tickets listed before filtering" })
      .toEqual(sorted(openGeneral, resolvedRefund, resolvedTechnical, closedRefund));

    const resolved = ticketFilter(page, "Status").getByRole("button", {
      name: "Resolved",
      exact: true,
    });
    const refund = ticketFilter(page, "Category").getByRole("button", {
      name: "Refund request",
      exact: true,
    });

    await resolved.click();
    await refund.click();

    await expect
      .poll(() => shownTicketIds(page, tag), { message: "filtered before the reload" })
      .toEqual([resolvedRefund]);

    await page.reload();

    // New document, empty query cache, no component state: both the pressed buttons and the
    // narrowed rows can only have come from the URL.
    await expect(resolved, "Resolved is still chosen after the reload").toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(refund, "Refund request is still chosen after the reload").toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() => shownTicketIds(page, tag), { message: "still filtered after the reload" })
      .toEqual([resolvedRefund]);
  });

  test("the API refuses a status it does not know", async ({ page }) => {
    const response = await page.request.get("/api/tickets?status=bogus");

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid query parameters" });
  });
});
