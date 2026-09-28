import { describe, expect, it } from "vitest";

import {
  columnFiltersFromQuery,
  queryFromColumnFilters,
  queryFromSorting,
  sortingFromQuery,
} from "@/lib/ticket-table-state";

describe("sortingFromQuery", () => {
  it("is newest first when the URL asks for no sort", () => {
    expect(sortingFromQuery({})).toEqual([{ id: "createdAt", desc: true }]);
  });

  it("uses a column's natural first direction when only the column is given", () => {
    expect(sortingFromQuery({ sort: "subject" })).toEqual([{ id: "subject", desc: false }]);
  });

  it("follows an explicit direction", () => {
    expect(sortingFromQuery({ sort: "category", dir: "desc" })).toEqual([{ id: "category", desc: true }]);
  });
});

describe("queryFromSorting", () => {
  it("writes a chosen sort as sort and dir", () => {
    expect(queryFromSorting([{ id: "subject", desc: true }])).toEqual({ sort: "subject", dir: "desc" });
  });

  it("keeps oldest-first received, which is not the default", () => {
    expect(queryFromSorting([{ id: "createdAt", desc: false }])).toEqual({ sort: "createdAt", dir: "asc" });
  });

  it.each([
    ["the default sort", [{ id: "createdAt", desc: true }]],
    ["no sort", []],
    ["a column the server cannot sort by", [{ id: "reference", desc: false }]],
  ])("clears both parameters for %s", (_label, sorting) => {
    const query = queryFromSorting(sorting);

    expect(query).toHaveProperty("sort", undefined);
    expect(query).toHaveProperty("dir", undefined);
  });

  it("round-trips with sortingFromQuery", () => {
    const query = { sort: "category", dir: "asc" } as const;

    expect(queryFromSorting(sortingFromQuery(query))).toEqual(query);
  });
});

describe("column filters", () => {
  it("holds only the filters the URL sets", () => {
    expect(columnFiltersFromQuery({ category: "REFUND_REQUEST" })).toEqual([
      { id: "category", value: "REFUND_REQUEST" },
    ]);
  });

  it("carries the assignee filter, which is not a column on the row", () => {
    expect(columnFiltersFromQuery({ assignee: "me" })).toEqual([{ id: "assignee", value: "me" }]);
  });

  // Every key has to be present, even undefined: withParams only clears what it iterates over.
  it("writes every filter key back, undefined for the missing ones", () => {
    const query = queryFromColumnFilters([{ id: "status", value: "OPEN" }]);

    expect(query).toEqual({ status: "OPEN", category: undefined, assignee: undefined });
    expect(query).toHaveProperty("category", undefined);
    expect(query).toHaveProperty("assignee", undefined);
  });

  it("round-trips the assignee filter", () => {
    expect(queryFromColumnFilters([{ id: "assignee", value: "none" }]).assignee).toBe("none");
  });

  it("drops an assignee value that is not a real filter", () => {
    expect(queryFromColumnFilters([{ id: "assignee", value: "all" }]).assignee).toBeUndefined();
  });

  it("drops a value that is not a real status or category", () => {
    expect(queryFromColumnFilters([{ id: "status", value: "all" }])).toEqual({
      status: undefined,
      category: undefined,
      assignee: undefined,
    });
  });
});
