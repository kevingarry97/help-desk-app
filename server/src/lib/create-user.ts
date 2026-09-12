import { auth } from "./auth";
import { prisma } from "../db";
import { USER_LIST_SELECT } from "./user-select";
import type { UserRole } from "../../generated/prisma/enums";

type NewUser = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};


export async function createUserWithPassword({ email, password, name, role }: NewUser) {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const user = await ctx.internalAdapter.createUser(
    { email, name, emailVerified: false },
    { method: "email-password" },
  );

  try {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } }).catch((cleanupError) => {
      console.error(`Failed to remove half-created user ${user.id}:`, cleanupError);
    });

    throw error;
  }

  return prisma.user.update({
    where: { id: user.id },
    data: { role },
    select: USER_LIST_SELECT,
  });
}
