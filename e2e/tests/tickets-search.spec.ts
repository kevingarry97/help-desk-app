import { expect, test, type Page } from "@playwright/test";

import {
  adminApiContext,
  createTicketByApi,
  shownTicketIds,
  ticketRows,
  uniqueTag,
} from "../helpers";
import { STORAGE_STATE } from "../test-env";

/**
 * Searching tickets by subject, requester email and reference. Component tests cover the
 * search box itself — debounce, trimming, the URL, clearing — against a mocked API, and the
 * WHERE builder is unit-tested as a plain object. Neither reaches Postgres. These show a query
 * typed into the real box reaching `ILIKE` and `LIKE '%…'` on real rows, and the route
 * validating and combining `q` with a status filter.
 *
 * Four tickets are made once for the describe. Three share the word "Billing" across three
 * statuses; one is found only by its requester email. Other specs leave tickets behind (the
 * database resets once per run, not per test), so each assertion either reads only this run's
 * tagged rows or, for a reference, which is unique by construction, the whole list.
 */

type Name = "billingPortal" | "passwordReset" | "billingRefund" | "billingQuestion";

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search tickets" });

/** A ticket list response item, as far as this spec reads it. */
type Listed = { id: string; subject: string; status: string };

test.describe("searching tickets, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  let tag = "";
  const id = {} as Record<Name, string>;
  const subject = {} as Record<Name, string>;
  let allOfThisRun: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    tag = uniqueTag();
    subject.billingPortal = `Search e2e Billing Portal outage ${tag}`;
    subject.passwordReset = `Search e2e Password reset ${tag}`;
    subject.billingRefund = `Search e2e Billing refund ${tag}`;
    subject.billingQuestion = `Search e2e Billing question ${tag}`;

    const api = await adminApiContext(playwright);

    try {
      id.billingPortal = await createTicketByApi(api, {
        subject: subject.billingPortal,
        requesterEmail: `portal.${tag}@example.com`,
        category: "GENERAL_QUESTION",
        status: "OPEN",
      });
      id.passwordReset = await createTicketByApi(api, {
        subject: subject.passwordReset,
        requesterEmail: `pat.quigley.${tag}@example.com`,
        category: "TECHNICAL_QUESTION",
        status: "RESOLVED",
      });
      id.billingRefund = await createTicketByApi(api, {
        subject: subject.billingRefund,
        requesterEmail: `refunds.${tag}@example.com`,
        category: "REFUND_REQUEST",
        status: "CLOSED",
      });
      id.billingQuestion = await createTicketByApi(api, {
        subject: subject.billingQuestion,
        requesterEmail: `questions.${tag}@example.com`,
        category: "GENERAL_QUESTION",
        status: "RESOLVED",
      });
    } finally {
      await api.dispose();
    }

    allOfThisRun = Object.values(id).sort();
  });

  /** Opens the unsearched list and waits until all four of this run's tickets are shown. */
  async function openFullList(page: Page) {
    await page.goto("/tickets");

    // The premise for every search below: before it, the tickets it should remove are there.
    await expect
      .poll(() => shownTicketIds(page, tag), { message: "all four tickets listed before searching" })
      .toEqual(allOfThisRun);
  }

  test("finds a ticket by part of its subject typed in a different case", async ({ page }) => {
    const query = "billing portal";

    // The premise, checked rather than assumed: only a case-insensitive match can find it.
    expect(subject.billingPortal.includes(query), "case-sensitive substring").toBe(false);
    expect(subject.billingPortal.toLowerCase().includes(query), "ignoring case").toBe(true);

    await openFullList(page);
    await searchBox(page).fill(query);

    await expect
      .poll(() => shownTicketIds(page, tag), { message: `only "${subject.billingPortal}" matches` })
      .toEqual([id.billingPortal]);
  });

  test("finds a ticket by part of its requester email", async ({ page }) => {
    const query = "quigley";

    expect(
      subject.passwordReset.toLowerCase().includes(query),
      "the subject must not contain the query, or this would pass on the subject clause",
    ).toBe(false);

    await openFullList(page);
    await searchBox(page).fill(query);

    await expect
      .poll(() => shownTicketIds(page, tag), { message: "only the ticket from pat.quigley matches" })
      .toEqual([id.passwordReset]);
  });

  test("finds exactly one ticket by the reference its row shows, with or without # and in any case", async ({
    page,
  }) => {
    await openFullList(page);

    // Read as displayed, not recomputed from the id: the point is that what an agent sees in
    // the Ref column is what the search matches.
    const referenceCell = ticketRows(page)
      .filter({ hasText: subject.billingRefund })
      .getByText(/^#[A-Z0-9]{6}$/);
    await expect(referenceCell).toBeVisible();
    const reference = (await referenceCell.textContent())!.trim();

    await searchBox(page).fill(reference);

    // The whole list, not just this run's rows: a reference must single out one ticket.
    await expect
      .poll(() => shownTicketIds(page), { message: `only ${reference} is listed` })
      .toEqual([id.billingRefund]);

    // A fresh list before the second form, so the assertion below cannot be satisfied by the
    // result of the first search still on screen.
    await openFullList(page);

    const bare = reference.slice(1).toLowerCase();
    await searchBox(page).fill(bare);

    await expect
      .poll(() => shownTicketIds(page), { message: `only ${reference} is listed for "${bare}"` })
      .toEqual([id.billingRefund]);
  });

  test("the API answers a search combined with a status with tickets matching both", async ({
    page,
  }) => {
    // Asked of the API, not the page: the list renders only the filtered status's section in
    // the browser, so a server that dropped `status` beside `q` would look the same there.
    const mine = async (params: Record<string, string>) => {
      const response = await page.request.get("/api/tickets", { params });
      expect(response.status(), `GET /api/tickets ${JSON.stringify(params)}`).toBe(200);

      const tickets = (await response.json()) as Listed[];
      return tickets.filter((ticket) => ticket.subject.includes(tag)).map((t) => t.id).sort();
    };

    // Control: the search alone matches the three Billing tickets, one per status.
    expect(await mine({ q: "billing" }), "search alone").toEqual(
      [id.billingPortal, id.billingRefund, id.billingQuestion].sort(),
    );

    // With a status, only the one that matches both. The resolved password reset matches the
    // status but not the search, so it can only be absent if the search still applies.
    expect(await mine({ q: "billing", status: "RESOLVED" }), "search and status").toEqual([
      id.billingQuestion,
    ]);
  });

  test("the API refuses a search longer than 200 characters", async ({ page }) => {
    // Control at the limit, so the refusal below is about length and not about `q` itself.
    const atLimit = await page.request.get("/api/tickets", { params: { q: "x".repeat(200) } });
    expect(atLimit.status(), "a 200-character search").toBe(200);

    const tooLong = await page.request.get("/api/tickets", { params: { q: "x".repeat(201) } });
    expect(tooLong.status(), "a 201-character search").toBe(400);
    expect(await tooLong.json()).toMatchObject({ error: "Invalid query parameters" });
  });
});
