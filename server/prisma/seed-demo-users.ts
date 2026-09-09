import { prisma } from "../src/db";
import { UserRole } from "../generated/prisma/enums";

/**
 * Fills the /users list with enough rows to see the ordering work. Development only.
 *
 * These rows have no credential account, so none of them can sign in — the users list reads
 * the `user` table and nothing else, and an account that could actually authenticate is not
 * something a convenience script should be able to create. Re-runnable; remove them with
 * `bun prisma/seed-demo-users.ts --clear`.
 */

const DEMO_DOMAIN = "@demo.helpdesk.local";

const DEMO_USERS = [
  { name: "Priya Raman", role: UserRole.agent },
  { name: "Marcus Bell", role: UserRole.agent },
  { name: "Sofia Almeida", role: UserRole.admin },
  { name: "Dan Okoye", role: UserRole.agent },
  { name: "Hannah Weiss", role: UserRole.agent },
  { name: "Tomas Lindqvist", role: UserRole.agent },
];

if (process.env.NODE_ENV === "production") {
  throw new Error("seed-demo-users.ts is a development convenience — refusing to run in production.");
}

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}${DEMO_DOMAIN}`;
}

if (process.argv.includes("--clear")) {
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
  });

  console.log(`Removed ${count} demo user(s)`);
} else {
  for (const { name, role } of DEMO_USERS) {
    const email = emailFor(name);

    await prisma.user.upsert({
      where: { email },
      update: { name, role },
      // `sortOrder` is left to its sequence default so each new row lands at the end of
      // whatever order an admin has already arranged.
      create: { id: crypto.randomUUID(), name, email, role, emailVerified: false },
    });
  }

  console.log(`Seeded ${DEMO_USERS.length} demo users (${DEMO_DOMAIN}) — none can sign in`);
}

await prisma.$disconnect();
