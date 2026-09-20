import { describe, expect, test } from "bun:test";
import { ticketListQuerySchema } from "core/schemas/tickets";

import { groupPage, groupStatuses } from "./ticket-groups";

describe("groupStatuses", () => {
  test("is every status, work still to do first, when none is filtered", () => {
    expect(groupStatuses({})).toEqual(["OPEN", "RESOLVED", "CLOSED"]);
  });

  test("is only the filtered status", () => {
    expect(groupStatuses({ status: "CLOSED" })).toEqual(["CLOSED"]);
  });
});

describe("groupPage", () => {
  test("serves page 1 when none is asked for", () => {
    expect(groupPage({}, "OPEN", 34)).toEqual({ page: 1, skip: 0, take: 10 });
  });

  test("reads each status's own page parameter", () => {
    const query = { openPage: 2, resolvedPage: 3, closedPage: 4 };

    expect(groupPage(query, "OPEN", 100).page).toBe(2);
    expect(groupPage(query, "RESOLVED", 100).page).toBe(3);
    expect(groupPage(query, "CLOSED", 100)).toEqual({ page: 4, skip: 30, take: 10 });
  });

  test.each([
    [34, 4],
    [30, 3],
    [0, 1],
  ])("pulls a page past the end of %p tickets back to page %p", (total, lastPage) => {
    expect(groupPage({ openPage: 99 }, "OPEN", total).page).toBe(lastPage);
  });
});

describe("ticketListQuerySchema page parameters", () => {
  test("reads query-string pages as numbers", () => {
    expect(ticketListQuerySchema.parse({ openPage: "2", closedPage: "5" })).toMatchObject({
      openPage: 2,
      closedPage: 5,
    });
  });

  test.each(["0", "-1", "1.5", "abc"])("refuses the page %p", (page) => {
    expect(ticketListQuerySchema.safeParse({ resolvedPage: page }).success).toBe(false);
  });
});
