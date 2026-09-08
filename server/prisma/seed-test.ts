import { prisma } from "../src/db";
import { UserRole } from "../generated/prisma/enums";
import { createUserWithPassword } from "./create-user";
import { assertTestDatabase, truncateAll } from "./test-db";

/**
 * Resets the E2E database to a known state: every table emptied, then one admin and one
 * agent. Run once per suite by e2e/global-setup.ts.
 *
 * Separate from seed.ts rather than an extension of it. seed.ts is the dev/prod bootstrap
 * and deliberately *refuses* to touch an existing non-admin user — a guard that must not be
 * relaxed to make a two-account test fixture idempotent. This script gets its idempotency
 * from the truncate instead, which is something seed.ts must never do.
 */

const admin = {
  email: process.env.ADMIN_EMAIL?.toLowerCase(),
  password: process.env.ADMIN_PASSWORD,
};

const agent = {
  email: process.env.AGENT_EMAIL?.toLowerCase(),
  password: process.env.AGENT_PASSWORD,
};

if (!admin.email || !admin.password || !agent.email || !agent.password) {
  throw new Error(
    "ADMIN_EMAIL, ADMIN_PASSWORD, AGENT_EMAIL and AGENT_PASSWORD must all be set — the E2E " +
      "harness supplies them from e2e/test-env.ts.",
  );
}

assertTestDatabase();
await truncateAll();

const [seededAdmin, seededAgent] = [
  await createUserWithPassword({
    email: admin.email,
    password: admin.password,
    name: "E2E Admin",
    role: UserRole.admin,
  }),
  await createUserWithPassword({
    email: agent.email,
    password: agent.password,
    name: "E2E Agent",
    role: UserRole.agent,
  }),
];

const [{ current_database: database }] =
  await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;

console.log(
  `Seeded ${database}: ${seededAdmin.email} (${seededAdmin.role}), ${seededAgent.email} (${seededAgent.role})`,
);

await prisma.$disconnect();
