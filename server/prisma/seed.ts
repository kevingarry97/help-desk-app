import { auth } from "../src/lib/auth";
import { prisma } from "../src/db";
import { UserRole } from "../generated/prisma/enums";

const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set — see .env.example");
}

const ctx = await auth.$context;

const existing = await prisma.user.findUnique({ where: { email } });

if (existing) {
  const user = await prisma.user.update({
    where: { email },
    data: { role: UserRole.admin },
  });
  console.log(`Admin already exists: ${user.email} (role: ${user.role}) — left password unchanged`);
} else {
  const hash = await ctx.password.hash(password);

  const user = await ctx.internalAdapter.createUser(
    { email, name: "Admin", emailVerified: false },
    { method: "email-password" },
  );

  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });

  const admin = await prisma.user.update({
    where: { id: user.id },
    data: { role: UserRole.admin },
  });

  console.log(`Created admin: ${admin.email} (role: ${admin.role})`);
}

await prisma.$disconnect();
