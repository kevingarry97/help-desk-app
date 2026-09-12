import { Router } from "express";
import { createUserSchema, reorderUsersSchema, updateUserSchema } from "core/schemas/users";
import { Role } from "core/constants/role";

import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { createUserWithPassword } from "../lib/create-user";
import { USER_LIST_ORDER, USER_LIST_SELECT } from "../lib/user-select";
import { validate } from "../lib/validate";
import { requireAuth } from "../middleware/require-auth";
import { requireRole } from "../middleware/require-role";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole(Role.Admin));

const USER_NOT_FOUND = { error: "That user no longer exists." };
const LAST_ADMIN = { error: "The helpdesk needs at least one admin." };

async function lockUserAndAdmins(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`
    SELECT "id" FROM "user"
    WHERE "id" = ${id} OR "role" = ${Role.Admin}::"UserRole"
    ORDER BY "id"
    FOR UPDATE
  `;

  const target = await tx.user.findUnique({ where: { id }, select: { role: true } });
  const adminCount = await tx.user.count({ where: { role: Role.Admin } });

  return { exists: target !== null, isLastAdmin: target?.role === Role.Admin && adminCount === 1 };
}

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: USER_LIST_SELECT,
    orderBy: [...USER_LIST_ORDER],
  });

  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const result = validate(createUserSchema, req.body, res);
  if (!result.ok) return;

  const { email } = result.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    res.status(409).json({ error: `${email} already has an account.` });
    return;
  }

  const user = await createUserWithPassword(result.data);
  res.status(201).json(user);
});

usersRouter.patch("/order", async (req, res) => {
  const result = validate(reorderUsersSchema, req.body, res);
  if (!result.ok) return;

  const { ids } = result.data;

  const users = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT "id" FROM "user" ORDER BY "id" FOR UPDATE`;

    const existing = await tx.user.findMany({ select: { id: true, updatedAt: true } });
    const updatedAtById = new Map(existing.map((user) => [user.id, user.updatedAt]));

    const matchesTable =
      existing.length === ids.length && ids.every((id) => updatedAtById.has(id));

    if (!matchesTable) return null;

    for (const [index, id] of ids.entries()) {
      await tx.user.update({
        where: { id },
        data: { sortOrder: index + 1, updatedAt: updatedAtById.get(id) },
      });
    }

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

usersRouter.patch("/:id", async (req, res) => {
  const result = validate(updateUserSchema, req.body, res);
  if (!result.ok) return;

  const { id } = req.params;
  const { email, role } = result.data;

  if (id === req.user?.id && role !== Role.Admin) {
    res.status(403).json({ error: "You can't remove your own admin role." });
    return;
  }

  const taken = await prisma.user.findFirst({
    where: { email, id: { not: id } },
    select: { id: true },
  });

  if (taken) {
    res.status(409).json({ error: `${email} already has an account.` });
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const { exists, isLastAdmin } = await lockUserAndAdmins(tx, id);

    if (!exists) return USER_NOT_FOUND;
    if (isLastAdmin && role !== Role.Admin) return LAST_ADMIN;

    return tx.user.update({ where: { id }, data: result.data, select: USER_LIST_SELECT });
  });

  if (user === USER_NOT_FOUND) {
    res.status(404).json(user);
    return;
  }

  if (user === LAST_ADMIN) {
    res.status(409).json(user);
    return;
  }

  res.json(user);
});

usersRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (id === req.user?.id) {
    res.status(403).json({ error: "You can't delete your own account." });
    return;
  }

  const refusal = await prisma.$transaction(async (tx) => {
    const { exists, isLastAdmin } = await lockUserAndAdmins(tx, id);

    if (!exists) return USER_NOT_FOUND;
    if (isLastAdmin) return LAST_ADMIN;

    await tx.user.delete({ where: { id } });
    return null;
  });

  if (refusal === USER_NOT_FOUND) {
    res.status(404).json(refusal);
    return;
  }

  if (refusal === LAST_ADMIN) {
    res.status(409).json(refusal);
    return;
  }

  res.status(204).end();
});
