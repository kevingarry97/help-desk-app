import { describe, expect, it } from "vitest";
import type { UserListItem } from "core/schemas/users";

import { applyOrder, moveItem } from "@/lib/reorder";

function user(id: string): UserListItem {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    role: "agent",
    image: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    sortOrder: 1,
  };
}

describe("moveItem", () => {
  it("moves an item down", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item up", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const items = ["a", "b", "c"];
    moveItem(items, 0, 2);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("returns the list unchanged for a no-op or an out-of-range index", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, -1, 0)).toBe(items);
    expect(moveItem(items, 0, 3)).toBe(items);
  });
});

describe("applyOrder", () => {
  it("reorders users to match the ids", () => {
    const users = [user("a"), user("b"), user("c")];

    expect(applyOrder(users, ["c", "a", "b"]).map((u) => u.id)).toEqual(["c", "a", "b"]);
  });

  it("drops ids with no matching user rather than leaving a hole", () => {
    const users = [user("a"), user("b")];

    expect(applyOrder(users, ["b", "ghost", "a"]).map((u) => u.id)).toEqual(["b", "a"]);
  });

  it("drops users the ids do not mention", () => {
    const users = [user("a"), user("b"), user("c")];

    expect(applyOrder(users, ["c", "a"]).map((u) => u.id)).toEqual(["c", "a"]);
  });
});
