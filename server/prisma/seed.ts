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
  // Never promote silently. ADMIN_EMAIL pointing at an existing agent — a typo, or a .env
  // reused across environments — would otherwise hand that account the admin role with
  // nothing in the log to show for it and no way to notice afterwards.
  if (existing.role !== UserRole.admin) {
    throw new Error(
      `${email} already exists with role "${existing.role}". Refusing to promote an ` +
        "existing account to admin — point ADMIN_EMAIL at a different address, or change " +
        "the role deliberately.",
    );
  }

  console.log(
    `Admin already exists: ${existing.email} (role: ${existing.role}) — left unchanged`,
  );
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
