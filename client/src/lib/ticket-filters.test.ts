import { describe, expect, it } from "vitest";

import { filtersFromSearchParams, hasFilters, withFilter, withoutFilters } from "@/lib/ticket-filters";

describe("filtersFromSearchParams", () => {
  it("reads a known status and category", () => {
    expect(
      filtersFromSearchParams(new URLSearchParams("status=RESOLVED&category=REFUND_REQUEST")),
    ).toEqual({ status: "RESOLVED", category: "REFUND_REQUEST" });
  });

  it("treats missing parameters as no filter", () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual({
      status: undefined,
      category: undefined,
      q: undefined,
    });
  });

  it("reads the search, trimmed", () => {
    expect(filtersFromSearchParams(new URLSearchParams("q=%20%20sam%20")).q).toBe("sam");
  });

  it.each(["", "   "])("treats the blank search %p as none", (q) => {
    expect(filtersFromSearchParams(new URLSearchParams({ q })).q).toBeUndefined();
  });

  it.each(["bogus", "open", ""])("ignores the unknown status %p but keeps a valid category", (status) => {
    const params = new URLSearchParams({ status, category: "TECHNICAL_QUESTION" });

    expect(filtersFromSearchParams(params)).toEqual({
      status: undefined,
      category: "TECHNICAL_QUESTION",
      q: undefined,
    });
  });
});

describe("withFilter", () => {
  it("sets a filter without disturbing the others or the original", () => {
    const original = new URLSearchParams("category=REFUND_REQUEST");

    const next = withFilter(original, "status", "OPEN");

    expect(next.toString()).toBe("category=REFUND_REQUEST&status=OPEN");
    expect(original.toString()).toBe("category=REFUND_REQUEST");
  });

  it("replaces a filter that is already set", () => {
    expect(withFilter(new URLSearchParams("status=OPEN"), "status", "CLOSED").toString()).toBe(
      "status=CLOSED",
    );
  });

  it("removes a filter when the value is undefined", () => {
    expect(
      withFilter(new URLSearchParams("status=OPEN&category=REFUND_REQUEST"), "status", undefined).toString(),
    ).toBe("category=REFUND_REQUEST");
  });
});

describe("withoutFilters", () => {
  it("removes the search and both filters, keeping anything else", () => {
    expect(
      withoutFilters(new URLSearchParams("status=OPEN&category=REFUND_REQUEST&q=sam&page=2")).toString(),
    ).toBe("page=2");
  });
});

describe("hasFilters", () => {
  it.each([
    [{}, false],
    [{ q: "" }, false],
    [{ status: "OPEN" as const }, true],
    [{ category: "REFUND_REQUEST" as const }, true],
    [{ q: "sam" }, true],
  ])("is %p → %p", (filters, expected) => {
    expect(hasFilters(filters)).toBe(expected);
  });
});
