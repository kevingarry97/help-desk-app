import { describe, expect, test } from "bun:test";

import { ticketListWhere } from "./ticket-where";

const VIEWER = "user_1";

describe("ticketListWhere", () => {
  test("passes status and category through, leaving absent ones undefined", () => {
    expect(ticketListWhere({ status: "OPEN" }, VIEWER)).toEqual({
      status: "OPEN",
      category: undefined,
      assigneeId: undefined,
    });
  });

  test.each([undefined, "", "   "])("adds no search for q = %p", (q) => {
    expect(ticketListWhere({ category: "REFUND_REQUEST", q }, VIEWER)).toEqual({
      status: undefined,
      category: "REFUND_REQUEST",
      assigneeId: undefined,
    });
  });

  test("searches subject and requester email, case-insensitively, alongside the filters", () => {
    expect(ticketListWhere({ status: "RESOLVED", q: "  refund please " }, VIEWER)).toEqual({
      status: "RESOLVED",
      category: undefined,
      assigneeId: undefined,
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
    expect(ticketListWhere({ q }, VIEWER).OR).toContainEqual({ id: { endsWith: suffix } });
  });

  test.each(["sam@example.com", "#1", "two words"])("does not treat %p as a reference", (q) => {
    const or = ticketListWhere({ q }, VIEWER).OR as object[];

    expect(or).toHaveLength(2);
    expect(or.some((clause) => "id" in clause)).toBe(false);
  });

  describe("assignee", () => {
    test("resolves 'me' to the signed-in user", () => {
      expect(ticketListWhere({ assignee: "me" }, VIEWER).assigneeId).toBe(VIEWER);
    });

    test("asks for a null column, not an absent filter, for 'none'", () => {
      const where = ticketListWhere({ assignee: "none" }, VIEWER);

      expect(where.assigneeId).toBeNull();
      expect("assigneeId" in where).toBe(true);
    });

    test("leaves the column out when no assignee is asked for", () => {
      expect(ticketListWhere({}, VIEWER).assigneeId).toBeUndefined();
    });

    // The search branch returns before the early return, so it has to carry the filter too.
    test("still applies alongside a search", () => {
      const where = ticketListWhere({ assignee: "me", q: "refund please" }, VIEWER);

      expect(where.assigneeId).toBe(VIEWER);
      expect(where.OR).toHaveLength(2);
    });
  });
});
