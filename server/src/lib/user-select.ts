/**
 * The shape /users speaks in — mirrors userListItemSchema in core/schemas/users.ts.
 *
 * Shared by the list, the reorder and the create route rather than repeated in each. No
 * password material lives on the User model, but selecting explicitly means a column added
 * later is not exposed by accident, and one definition means it cannot be tightened in one
 * route and forgotten in another.
 */
export const USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  image: true,
  createdAt: true,
  sortOrder: true,
} as const;

/**
 * createdAt breaks ties: sortOrder is not unique, and rows that have never been reordered
 * carry sequence values that only happen to be distinct.
 */
export const USER_LIST_ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const;
