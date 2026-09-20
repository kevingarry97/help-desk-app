import { expect, test, type Locator, type Page } from "@playwright/test";

import { adminApiContext, createTicketByApi, uniqueTag } from "../helpers";
import { STORAGE_STATE } from "../test-env";

/**
 * Per-status paging. Component tests drive the sections from a mocked response — page-sized
 * rows, the range text, disabled ends, the page parameter, the resets — and groupPage is
 * unit-tested as a plain object. Neither asks Postgres for a second page. These show the
 * server counting and slicing real rows, the browser asking for the page in the URL, and the
 * two surviving a reload.
 *
 * Fifteen tickets are made once for the describe: twelve open, so that section pages, and
 * three resolved, so a second section is there to stay still while the first one pages. Their
 * subjects are numbered A01–A12 and created in that order, so subject A–Z and the default
 * newest-first order are exact reverses and no assertion can pass for the other.
 *
 * Other specs leave tickets behind (the database resets once per run, not per test), and a
 * section shows only its first ten, so every page below is loaded as /tickets?q=<tag>: the
 * search narrows both sections to this run's tickets.
 */

const PAGE_SIZE = 10;
const OPEN_COUNT = 12;
const RESOLVED_COUNT = 3;

/** A group of GET /api/tickets/by-status, as far as this spec reads it. */
type Group = {
  status: string;
  total: number;
  page: number;
  pageSize: number;
  tickets: { id: string }[];
};

const section = (page: Page, name: "Open" | "Resolved") =>
  page.getByRole("region", { name: `${name} tickets` });

const rowsIn = (group: Locator) => group.getByTestId("ticket-row");

const pagerIn = (group: Locator, name: "Open" | "Resolved") =>
  group.getByRole("navigation", { name: `${name} tickets pages` });

/** The ids in `group`, top to bottom. Reads once without waiting, so expect.poll can retry. */
const idsIn = (group: Locator): Promise<string[]> =>
  rowsIn(group).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ticket-id") ?? ""));

test.describe("paging the ticket list, signed in as an agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  let tag = "";
  /** Open ticket ids by their subject number, "A01" to "A12". */
  const open: Record<string, string> = {};

  /** The subject numbers in the order the given page of the Open section should show. */
  const openIds = (...numbers: string[]) => numbers.map((number) => open[number]!);

  test.beforeAll(async ({ playwright }) => {
    tag = uniqueTag();
    const api = await adminApiContext(playwright);

    try {
      // A01 first, so A12 is the newest: subject A–Z is the reverse of the default order.
      for (let index = 1; index <= OPEN_COUNT; index += 1) {
        const number = `A${String(index).padStart(2, "0")}`;

        open[number] = await createTicketByApi(api, {
          subject: `Page e2e ${tag} ${number}`,
          requesterEmail: `page.${number.toLowerCase()}.${tag}@example.com`,
          category: "GENERAL_QUESTION",
          status: "OPEN",
        });
      }

      for (let index = 1; index <= RESOLVED_COUNT; index += 1) {
        await createTicketByApi(api, {
          subject: `Page e2e ${tag} R${index}`,
          requesterEmail: `page.r${index}.${tag}@example.com`,
          category: "TECHNICAL_QUESTION",
          status: "RESOLVED",
        });
      }
    } finally {
      await api.dispose();
    }
  });

  /** The list narrowed to this run's tickets, with `extra` query parameters appended. */
  const listUrl = (extra = "") => `/tickets?q=${tag}${extra}`;

  test("shows the first ten open tickets with a count of all twelve, and pages to the rest", async ({
    page,
  }) => {
    await page.goto(listUrl());

    const openGroup = section(page, "Open");
    const resolvedGroup = section(page, "Resolved");

    // The heading counts every match; only a page of them is on screen. A page length used as
    // the count would say 10 here.
    await expect(page.getByRole("button", { name: `Open, ${OPEN_COUNT} tickets` })).toBeVisible();
    await expect(rowsIn(openGroup)).toHaveCount(PAGE_SIZE);
    await expect(pagerIn(openGroup, "Open")).toContainText(`1–${PAGE_SIZE} of ${OPEN_COUNT}`);

    // The other section is complete on one page, so it has nothing to page with.
    await expect(rowsIn(resolvedGroup)).toHaveCount(RESOLVED_COUNT);
    await expect(pagerIn(resolvedGroup, "Resolved")).toHaveCount(0);
    const resolvedBefore = await idsIn(resolvedGroup);

    await openGroup.getByRole("button", { name: "Next page of open tickets" }).click();

    // The remaining two can only have come from the server: they were never on the page.
    await expect(rowsIn(openGroup)).toHaveCount(OPEN_COUNT - PAGE_SIZE);
    await expect(pagerIn(openGroup, "Open")).toContainText(
      `${PAGE_SIZE + 1}–${OPEN_COUNT} of ${OPEN_COUNT}`,
    );
    await expect(page).toHaveURL(listUrl("&openPage=2"));

    // Paging one section leaves the other where it was.
    await expect(rowsIn(resolvedGroup)).toHaveCount(RESOLVED_COUNT);
    expect(await idsIn(resolvedGroup), "the resolved section did not move").toEqual(resolvedBefore);
  });

  test("continues the chosen sort order onto the second page", async ({ page }) => {
    await page.goto(listUrl("&sort=subject&dir=asc"));

    const openGroup = section(page, "Open");

    await expect
      .poll(() => idsIn(openGroup), { message: "subject A–Z, first page" })
      .toEqual(openIds("A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"));

    await openGroup.getByRole("button", { name: "Next page of open tickets" }).click();

    // The rest of the same order, not the start of the default one — which would be A12, A11.
    await expect
      .poll(() => idsIn(openGroup), { message: "subject A–Z, second page" })
      .toEqual(openIds("A11", "A12"));
  });

  test("stays on the second page across a reload", async ({ page }) => {
    await page.goto(listUrl());

    const openGroup = section(page, "Open");
    await expect(rowsIn(openGroup)).toHaveCount(PAGE_SIZE);

    await openGroup.getByRole("button", { name: "Next page of open tickets" }).click();
    await expect(rowsIn(openGroup)).toHaveCount(OPEN_COUNT - PAGE_SIZE);
    const secondPage = await idsIn(openGroup);

    await page.reload();

    // New document, empty query cache: the page number came back from the URL and the rows
    // from the server.
    await expect(rowsIn(openGroup)).toHaveCount(OPEN_COUNT - PAGE_SIZE);
    await expect(pagerIn(openGroup, "Open")).toContainText(
      `${PAGE_SIZE + 1}–${OPEN_COUNT} of ${OPEN_COUNT}`,
    );
    expect(await idsIn(openGroup), "the same second page after the reload").toEqual(secondPage);
  });

  test("returns to the first page when the sort changes", async ({ page }) => {
    await page.goto(listUrl("&openPage=2"));

    const openGroup = section(page, "Open");
    await expect(rowsIn(openGroup)).toHaveCount(OPEN_COUNT - PAGE_SIZE);

    await openGroup.getByRole("columnheader", { name: "Ticket", exact: true }).getByRole("button").click();

    // A new order makes the old page number meaningless, so it goes from the URL as well.
    await expect(page).toHaveURL(listUrl("&sort=subject&dir=asc"));
    await expect(rowsIn(openGroup)).toHaveCount(PAGE_SIZE);
    await expect(pagerIn(openGroup, "Open")).toContainText(`1–${PAGE_SIZE} of ${OPEN_COUNT}`);
  });

  test.describe("through the API", () => {
    /** GET /api/tickets/by-status narrowed to this run's tickets. */
    async function groupsFor(page: Page, params: Record<string, string> = {}): Promise<Group[]> {
      const response = await page.request.get("/api/tickets/by-status", {
        params: { q: tag, ...params },
      });
      expect(response.status(), `by-status ${JSON.stringify(params)}`).toBe(200);

      return ((await response.json()) as { groups: Group[] }).groups;
    }

    test("answers one group per status, each with its own total and page", async ({ page }) => {
      const groups = await groupsFor(page);

      expect(groups.map((group) => group.status)).toEqual(["OPEN", "RESOLVED", "CLOSED"]);
      expect(
        groups.map((group) => [group.status, group.total, group.tickets.length, group.page]),
        "status, total, tickets on this page, page",
      ).toEqual([
        ["OPEN", OPEN_COUNT, PAGE_SIZE, 1],
        ["RESOLVED", RESOLVED_COUNT, RESOLVED_COUNT, 1],
        ["CLOSED", 0, 0, 1],
      ]);
    });

    test("serves the last two open tickets on page two, and clamps a page past the end", async ({
      page,
    }) => {
      const [secondPage] = await groupsFor(page, { openPage: "2" });
      expect(secondPage!.page, "the page asked for").toBe(2);
      expect(secondPage!.tickets).toHaveLength(OPEN_COUNT - PAGE_SIZE);

      // Past the end is pulled back to the last real page rather than answered empty, and the
      // response says which page that was.
      const [clamped] = await groupsFor(page, { openPage: "99" });
      expect(clamped!.page, "a page past the end").toBe(2);
      expect(clamped!.tickets.map((ticket) => ticket.id)).toEqual(
        secondPage!.tickets.map((ticket) => ticket.id),
      );
    });

    test("answers only the filtered status when one is asked for", async ({ page }) => {
      const groups = await groupsFor(page, { status: "RESOLVED" });

      expect(groups.map((group) => group.status)).toEqual(["RESOLVED"]);
      expect(groups[0]!.total).toBe(RESOLVED_COUNT);
    });

    test("refuses a page number that is not a whole number from one", async ({ page }) => {
      for (const openPage of ["0", "abc"]) {
        const response = await page.request.get("/api/tickets/by-status", {
          params: { openPage },
        });

        expect(response.status(), `openPage=${openPage}`).toBe(400);
        expect(await response.json()).toMatchObject({ error: "Invalid query parameters" });
      }
    });
  });
});
