import type { UserListItem } from "core/schemas/users";

/**
 * Test data builders.
 *
 * Every field has a default, so a test names only what it is actually about — a test that
 * cares about the role says `{ role: "admin" }` and stays readable when the schema grows a
 * field it does not care about.
 */

let sequence = 0;

/** A user with defaults for everything. Ids are unique per call unless one is given. */
export function makeUser(overrides: Partial<UserListItem> = {}): UserListItem {
  sequence += 1;

  return {
    id: String(sequence),
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "agent",
    image: null,
    createdAt: "2026-03-04T10:00:00.000Z",
    sortOrder: sequence,
    ...overrides,
  };
}

/**
 * A list in the order given, with `id` and `sortOrder` assigned by position so a test does
 * not have to keep them in sync by hand — the ordering is what most of these tests assert.
 */
export function makeUsers(...users: Partial<UserListItem>[]): UserListItem[] {
  return users.map((overrides, index) =>
    makeUser({ id: String(index + 1), sortOrder: index + 1, ...overrides }),
  );
}

/** Resets the id sequence so ids are predictable within a test file. */
export function resetUserSequence(): void {
  sequence = 0;
}
