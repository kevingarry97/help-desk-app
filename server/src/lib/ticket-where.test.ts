import { describe, expect, test } from "bun:test";

import { ticketListWhere } from "./ticket-where";

describe("ticketListWhere", () => {
  test("passes status and category through, leaving absent ones undefined", () => {
    expect(ticketListWhere({ status: "OPEN" })).toEqual({ status: "OPEN", category: undefined });
  });

  test.each([undefined, "", "   "])("adds no search for q = %p", (q) => {
    expect(ticketListWhere({ category: "REFUND_REQUEST", q })).toEqual({
      status: undefined,
      category: "REFUND_REQUEST",
    });
  });

  test("searches subject and requester email, case-insensitively, alongside the filters", () => {
    expect(ticketListWhere({ status: "RESOLVED", q: "  refund please " })).toEqual({
      status: "RESOLVED",
      category: undefined,
      OR: [
        { subject: { contains: "refund please", mode: "insensitive" } },
        { requesterEmail: { contains: "refund please", mode: "insensitive" } },
      ],
    });
  });

  test.each([
    ["#K3F9QZ", "k3f9qz"],
    ["k3f9qz", "k3f9qz"],
    ["sam", "sam"],
  ])("also matches the end of the id when %p looks like a reference", (q, suffix) => {
    expect(ticketListWhere({ q }).OR).toContainEqual({ id: { endsWith: suffix } });
  });

  test.each(["sam@example.com", "#1", "two words"])("does not treat %p as a reference", (q) => {
    const or = ticketListWhere({ q }).OR as object[];

    expect(or).toHaveLength(2);
    expect(or.some((clause) => "id" in clause)).toBe(false);
  });
});
