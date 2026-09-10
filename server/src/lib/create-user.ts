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

/**
 * Creates a credential account the way Better Auth expects, then sets its role.
 *
 * Sign-up is disabled, so this is the only path that produces a usable account — shared by
 * the admin create endpoint (routes/users.ts), the dev/prod seed (prisma/seed.ts) and the
 * E2E seed (prisma/seed-test.ts) rather than duplicated, since getting the account linkage
 * wrong fails at sign-in rather than here.
 */
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
    // The user row is already written and the credential is the half that makes it usable.
    // Left behind, it would sit in the admin list as an account nobody can sign in to and
    // whose address is now taken, so a second attempt fails as a duplicate. Not a
    // transaction: internalAdapter runs its own queries and takes no client.
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
