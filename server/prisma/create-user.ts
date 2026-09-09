import { auth } from "../src/lib/auth";
import { prisma } from "../src/db";
import type { UserRole } from "../generated/prisma/enums";

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
 * the dev/prod seed (seed.ts) and the E2E seed (seed-test.ts) rather than duplicated, since
 * getting the account linkage wrong fails at sign-in rather than here.
 */
export async function createUserWithPassword({ email, password, name, role }: NewUser) {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const user = await ctx.internalAdapter.createUser(
    { email, name, emailVerified: false },
    { method: "email-password" },
  );

  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });

  return prisma.user.update({ where: { id: user.id }, data: { role } });
}
