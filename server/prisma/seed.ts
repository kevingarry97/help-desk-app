import { prisma } from "../src/db";
import { UserRole } from "../generated/prisma/enums";
import { createUserWithPassword } from "./create-user";

const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set — see .env.example");
}

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
  const admin = await createUserWithPassword({
    email,
    password,
    name: "Admin",
    role: UserRole.admin,
  });

  console.log(`Created admin: ${admin.email} (role: ${admin.role})`);
}

await prisma.$disconnect();
