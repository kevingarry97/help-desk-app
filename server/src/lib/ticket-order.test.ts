import { describe, expect, test } from "bun:test";

import { ticketListOrderBy } from "./ticket-order";

describe("ticketListOrderBy", () => {
  test("is newest first, id breaking ties, when no sort is asked for", () => {
    expect(ticketListOrderBy({})).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  test("orders received oldest first when asked, ties in the same direction", () => {
    expect(ticketListOrderBy({ sort: "createdAt", dir: "asc" })).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });

  test.each(["subject", "category"] as const)("sorts %s A–Z by default", (sort) => {
    expect(ticketListOrderBy({ sort })[0]).toEqual({ [sort]: "asc" });
  });

  test("sorts subject Z–A when asked", () => {
    expect(ticketListOrderBy({ sort: "subject", dir: "desc" })[0]).toEqual({ subject: "desc" });
  });

  test.each(["subject", "category"] as const)("breaks %s ties newest first, then by id", (sort) => {
    expect(ticketListOrderBy({ sort, dir: "desc" }).slice(1)).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  test("ignores filters and search, which only shape the WHERE", () => {
    expect(ticketListOrderBy({ status: "OPEN", q: "sam" })).toEqual(ticketListOrderBy({}));
  });
});
