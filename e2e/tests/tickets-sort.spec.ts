import { expect, test, type Locator, type Page } from "@playwright/test";

import { adminApiContext, createTicketByApi, uniqueTag } from "../helpers";
import { STORAGE_STATE } from "../test-env";

/**
 * Sorting the ticket list on the server. Component tests cover the header buttons, aria-sort
 * and the URL each click writes, against a mocked API; ticketListOrderBy is unit-tested as a
 * plain object. Neither reaches Postgres. These show a header click in the browser reordering
 * real rows because the server ordered them, the sort surviving a reload, and — through the
 * API — category ordering by the enum's declared order, validation, and sort combined with a
 * search.
 *
 * Three open tickets are made once for the describe, created in the order Mango, Apple, Zebra
 * with the categories General, Refund, Technical. That makes every ordering asserted below a
 * different permutation of the three — newest first, oldest first, subject A–Z and Z–A,
 * category ascending and descending — so no assertion can be satisfied by the order that was
 * on screen before the click, and alphabetical category order (which is oldest first here)
 * cannot pass for declared order.
 *
 * Other specs leave tickets behind (the database resets once per run, not per test), and each
 * status section shows only its first 10 tickets, so the UI tests search for this run's tag to
 * narrow the Open section to these three, and orders are compared among the tagged rows only.
 */

type Name = "mango" | "apple" | "zebra";

/** A ticket list response item, as far as this spec reads it. */
type Listed = { id: string; subject: string };

/** The Open section; all of this spec's tickets are open. */
const openSection = (page: Page) => page.getByRole("region", { name: "Open tickets" });

/**
 * A sortable column's header cell within one section. By columnheader and exact name: each
 * section has its own header row, and a substring "Ticket" also matches the section's
 * "Open, N tickets" toggle.
 */
const columnHeader = (section: Locator, name: "Ticket" | "Category" | "Received") =>
  section.getByRole("columnheader", { name, exact: true });

/** This run's visible rows in `section`, top to bottom. Reads once; pass it to expect.poll. */
function orderIn(section: Locator, tag: string): Promise<string[]> {
  return section
    .getByTestId("ticket-row")
    .filter({ hasText: tag })
    .evaluateAll((rows) =>
      rows
        .filter((row) => row.checkVisibility())
        .map((row) => row.getAttribute("data-ticket-id") ?? ""),
    );
}

test.describe("sorting tickets, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  let tag = "";
  const id = {} as Record<Name, string>;

  const newestFirst = () => [id.zebra, id.apple, id.mango];
  const oldestFirst = () => [id.mango, id.apple, id.zebra];
  const subjectAToZ = () => [id.apple, id.mango, id.zebra];
  const subjectZToA = () => [id.zebra, id.mango, id.apple];

  test.beforeAll(async ({ playwright }) => {
    tag = uniqueTag();
    const api = await adminApiContext(playwright);

    try {
      // Sequential, so createdAt increases in this order; the Received test checks it did.
      id.mango = await createTicketByApi(api, {
        subject: `Sort e2e ${tag} Mango crate box`,
        requesterEmail: `sort.mango.${tag}@example.com`,
        category: "GENERAL_QUESTION",
        status: "OPEN",
      });
      id.apple = await createTicketByApi(api, {
        subject: `Sort e2e ${tag} Apple stripes`,
        requesterEmail: `sort.apple.${tag}@example.com`,
        category: "REFUND_REQUEST",
        status: "OPEN",
      });
      id.zebra = await createTicketByApi(api, {
        subject: `Sort e2e ${tag} Zebra crate box`,
        requesterEmail: `sort.zebra.${tag}@example.com`,
        category: "TECHNICAL_QUESTION",
        status: "OPEN",
      });
    } finally {
      await api.dispose();
    }
  });

  /**
   * Opens the list searched down to this run's three tickets — a section pages at 10, and other
   * specs' tickets would otherwise push these off the first page — and waits for the default order.
   */
  async function openDefaultList(page: Page): Promise<Locator> {
    await page.goto(`/tickets?q=${encodeURIComponent(tag)}`);
    const open = openSection(page);

    await expect
      .poll(() => orderIn(open, tag), { message: "newest first before any sort is chosen" })
      .toEqual(newestFirst());

    return open;
  }

  test("orders a section's rows by subject A–Z, then Z–A", async ({ page }) => {
    const open = await openDefaultList(page);
    const sortBySubject = columnHeader(open, "Ticket").getByRole("button");

    await sortBySubject.click();
    await expect
      .poll(() => orderIn(open, tag), { message: "subject A–Z after the first click" })
      .toEqual(subjectAToZ());

    await sortBySubject.click();
    await expect
      .poll(() => orderIn(open, tag), { message: "subject Z–A after the second click" })
      .toEqual(subjectZToA());
  });

  test("orders by Received oldest first, then back to newest first", async ({ page }) => {
    const open = await openDefaultList(page);

    // The premise, checked rather than assumed: the three were stored at distinct, increasing
    // times, so the order below is decided by createdAt and not by the id tiebreak.
    const receivedAt = await open
      .getByTestId("ticket-row")
      .filter({ hasText: tag })
      .evaluateAll((rows) =>
        Object.fromEntries(
          rows.map((row) => [
            row.getAttribute("data-ticket-id") ?? "",
            Date.parse(row.querySelector("time")?.getAttribute("datetime") ?? ""),
          ]),
        ),
      );
    expect(receivedAt[id.apple], "Apple stored after Mango").toBeGreaterThan(receivedAt[id.mango]!);
    expect(receivedAt[id.zebra], "Zebra stored after Apple").toBeGreaterThan(receivedAt[id.apple]!);

    const sortByReceived = columnHeader(open, "Received").getByRole("button");

    await sortByReceived.click();
    await expect
      .poll(() => orderIn(open, tag), { message: "oldest first after the first click" })
      .toEqual(oldestFirst());

    await sortByReceived.click();
    await expect
      .poll(() => orderIn(open, tag), { message: "newest first again after the second click" })
      .toEqual(newestFirst());
  });

  test("keeps a chosen sort across a reload, aria-sort included", async ({ page }) => {
    const open = await openDefaultList(page);

    await columnHeader(open, "Ticket").getByRole("button").click();
    await expect
      .poll(() => orderIn(open, tag), { message: "subject A–Z before the reload" })
      .toEqual(subjectAToZ());

    await page.reload();

    // New document, empty query cache, no table state: the header's state and the order can
    // only have come from the URL, and the order only from the server honouring it.
    await expect(
      columnHeader(open, "Ticket"),
      "Ticket is still the ascending sort after the reload",
    ).toHaveAttribute("aria-sort", "ascending");
    await expect
      .poll(() => orderIn(open, tag), { message: "subject A–Z after the reload" })
      .toEqual(subjectAToZ());
  });

  test.describe("through the API", () => {
    /** This run's tickets in the order GET /api/tickets answers with `params`. */
    async function listedOrder(page: Page, params: Record<string, string>): Promise<string[]> {
      const response = await page.request.get("/api/tickets", { params });
      expect(response.status(), `GET /api/tickets ${JSON.stringify(params)}`).toBe(200);

      const tickets = (await response.json()) as Listed[];
      return tickets.filter((ticket) => ticket.subject.includes(tag)).map((ticket) => ticket.id);
    }

    test("orders categories as declared — General, Technical, Refund — not alphabetically", async ({
      page,
    }) => {
      expect(
        await listedOrder(page, { sort: "category", dir: "asc" }),
        "category ascending",
      ).toEqual([id.mango, id.zebra, id.apple]);

      expect(
        await listedOrder(page, { sort: "category", dir: "desc" }),
        "category descending",
      ).toEqual([id.apple, id.zebra, id.mango]);
    });

    test("sorts only the tickets a search matches", async ({ page }) => {
      // Mango and Zebra say "crate box"; Apple does not. Subject A–Z puts Mango first, the
      // reverse of the default newest-first order, so both the search and the sort must apply.
      expect(
        await listedOrder(page, { q: "crate box", sort: "subject", dir: "asc" }),
        "search and subject A–Z",
      ).toEqual([id.mango, id.zebra]);
    });

    test("refuses an unknown sort field or direction", async ({ page }) => {
      const field = await page.request.get("/api/tickets", { params: { sort: "bogus" } });
      expect(field.status(), "sort=bogus").toBe(400);
      expect(await field.json()).toMatchObject({ error: "Invalid query parameters" });

      const direction = await page.request.get("/api/tickets", { params: { dir: "sideways" } });
      expect(direction.status(), "dir=sideways").toBe(400);
      expect(await direction.json()).toMatchObject({ error: "Invalid query parameters" });
    });
  });
});
