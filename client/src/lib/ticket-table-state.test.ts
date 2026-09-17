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

  it("writes both filter keys back, undefined for the missing one", () => {
    const query = queryFromColumnFilters([{ id: "status", value: "OPEN" }]);

    expect(query).toEqual({ status: "OPEN", category: undefined });
    expect(query).toHaveProperty("category", undefined);
  });

  it("drops a value that is not a real status or category", () => {
    expect(queryFromColumnFilters([{ id: "status", value: "all" }])).toEqual({
      status: undefined,
      category: undefined,
    });
  });
});
