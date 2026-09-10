import { Router } from "express";
import { createUserSchema, reorderUsersSchema } from "core/schemas/users";
import { Role } from "core/constants/role";

import { prisma } from "../db";
import { createUserWithPassword } from "../lib/create-user";
import { isUniqueViolation } from "../lib/prisma-errors";
import { USER_LIST_ORDER, USER_LIST_SELECT } from "../lib/user-select";
import { validate } from "../lib/validate";
import { requireAuth } from "../middleware/require-auth";
import { requireRole } from "../middleware/require-role";

export const usersRouter = Router();

// The whole directory is admin-only. AdminRoute on the client decides what the browser
// renders and nothing more — this is the access boundary.
usersRouter.use(requireAuth, requireRole(Role.Admin));

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: USER_LIST_SELECT,
    orderBy: [...USER_LIST_ORDER],
  });

  res.json(users);
});

/**
 * Creates an account. Sign-up is disabled, so this is how every agent and admin after the
 * seeded one comes to exist.
 *
 * `sortOrder` is deliberately not set: its sequence default puts the new row at the end of
 * whatever order an admin has already arranged, which is where a brand new colleague
 * belongs. The response is the created row in list shape, so the client can show it without
 * waiting for a refetch.
 */
usersRouter.post("/", async (req, res) => {
  const result = validate(createUserSchema, req.body, res);
  if (!result.ok) return;

  const { email } = result.data;

  const duplicate = () => {
    res.status(409).json({ error: `${email} already has an account.` });
  };

  // Checked up front so the ordinary case — an address that is already in the list — is
  // answered by name, rather than by the constraint failure, which surfaces from inside
  // Better Auth's adapter attached to no particular field.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    duplicate();
    return;
  }

  try {
    const user = await createUserWithPassword(result.data);
    res.status(201).json(user);
  } catch (error) {
    // Two admins submitting the same address at once: the check above passed for both and
    // the unique index caught the loser. That is the same answer, not a 500.
    if (!isUniqueViolation(error)) throw error;

    duplicate();
  }
});

/**
 * Rewrites the display order from a full list of ids.
 *
 * The client sends every id it has on screen, not just the row that moved, so the request
 * carries the client's idea of the list along with the new arrangement. If that set no
 * longer matches the table — a user was created or deleted while the admin was dragging —
 * the positions being sent describe a list that no longer exists, and applying them would
 * silently drop the missing row's neighbours into the wrong slots. That case answers 409
 * and the client refetches instead.
 */
usersRouter.patch("/order", async (req, res) => {
  const result = validate(reorderUsersSchema, req.body, res);
  if (!result.ok) return;

  const { ids } = result.data;

  const users = await prisma.$transaction(async (tx) => {
    // Lock every user row for the life of the transaction so two admins reordering at the
    // same time serialise: the second one's set check runs against the first one's result.
    await tx.$queryRaw`SELECT "id" FROM "user" ORDER BY "id" FOR UPDATE`;

    const existing = await tx.user.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((user) => user.id));

    const matchesTable =
      existing.length === ids.length && ids.every((id) => existingIds.has(id));

    if (!matchesTable) return null;

    // One statement rather than a write per row: WITH ORDINALITY turns the array's index
    // into the new position. `updatedAt` is deliberately left alone — the order is how an
    // admin arranged the list, not a change to the accounts themselves, and bumping it here
    // would make every reorder look like every user had just been edited.
    await tx.$executeRaw`
      UPDATE "user" AS u
      SET "sortOrder" = position::integer
      FROM unnest(${ids}::text[]) WITH ORDINALITY AS ordered(id, position)
      WHERE u."id" = ordered.id
    `;

    // Renumbering by hand leaves the sequence behind whatever the new maximum is, and the
    // next user created would then be handed a value from the middle of the list rather
    // than the end. Push it past the top so `@default(autoincrement())` keeps meaning
    // "last".
    await tx.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('"user"', 'sortOrder'),
        (SELECT max("sortOrder") FROM "user"),
        true
      )
    `;

    return tx.user.findMany({ select: USER_LIST_SELECT, orderBy: [...USER_LIST_ORDER] });
  });

  if (!users) {
    res.status(409).json({
      error: "The user list changed while you were reordering it. Refresh and try again.",
    });
    return;
  }

  res.json(users);
});
