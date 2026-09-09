import type { UserListItem } from "core/schemas/users";

export function applyOrder(users: UserListItem[], ids: string[]): UserListItem[] {
  const byId = new Map(users.map((user) => [user.id, user]));

  return ids.flatMap((id) => {
    const user = byId.get(id);
    return user ? [user] : [];
  });
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;

  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  return next;
}
