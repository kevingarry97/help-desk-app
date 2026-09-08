import { Client } from "pg";

/**
 * Provisioning and reset for the E2E database, driven by whatever DATABASE_URL is in the
 * environment (see e2e/test-env.ts). Uses `pg` directly rather than psql or docker: neither
 * is guaranteed to be on PATH, and Prisma 7's `db execute` takes its datasource from
 * prisma.config.ts with no --url escape hatch.
 *
 * CLI: `bun prisma/test-db.ts create | truncate | reset-rate-limits | drop`
 */

const raw = process.env.DATABASE_URL;

if (!raw) {
  throw new Error("DATABASE_URL is not set — this script is run by the E2E harness, not by hand.");
}

// Prisma's ?schema=public is meaningless to pg, so it is stripped from every connection
// string built here.
const url = new URL(raw);
url.search = "";

const name = decodeURIComponent(url.pathname.slice(1));

/**
 * Run bare inside server/, these scripts would pick the *development* DATABASE_URL up from
 * .env and drop or truncate it. Both checks are deliberate: the suffix keeps this pointed at
 * throwaway databases, the character class keeps the name safe to quote into DDL, which is
 * unavoidable because identifiers cannot be parameterised.
 */
export function assertTestDatabase(): void {
  if (!/^[A-Za-z0-9_]+$/.test(name) || !name.endsWith("_test")) {
    throw new Error(
      `Refusing to operate on database "${name}": the E2E database name must be alphanumeric ` +
        'and end in "_test".',
    );
  }
}

function maintenanceConnectionString(): string {
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  return maintenance.toString();
}

async function withClient<T>(connectionString: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Idempotent. Postgres has no CREATE DATABASE IF NOT EXISTS, hence check-then-create. */
export async function createTestDatabase(): Promise<void> {
  assertTestDatabase();

  await withClient(maintenanceConnectionString(), async (client) => {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);

    if (existing.rowCount) {
      console.log(`Test database "${name}" already exists`);
      return;
    }

    try {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`Created test database "${name}"`);
    } catch (error) {
      // 42P04 = duplicate_database: another process won the race between the check above
      // and this statement. That is the outcome we wanted anyway.
      if ((error as { code?: string }).code !== "42P04") throw error;
      console.log(`Test database "${name}" already exists`);
    }
  });
}

/**
 * Empties every table without touching the schema — far faster than `prisma migrate reset`,
 * and it leaves a running server's connection pool valid.
 *
 * The list is read from the catalogue rather than hardcoded so new models are covered
 * automatically, and format('%I') quotes the two names that need it ("Ticket" has no @@map,
 * "rateLimit" is camelCase). Clearing "rateLimit" is the point of doing this before signing
 * in: Better Auth persists its counters there, so a previous run would otherwise 429 this one.
 *
 * Only the public schema is touched. If pg-boss is ever added, widen this to its `pgboss`
 * schema as well.
 */
export async function truncateAll(): Promise<void> {
  assertTestDatabase();

  await withClient(url.toString(), async (client) => {
    const { rows } = await client.query<{ tables: string | null }>(
      `SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') AS tables
         FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );

    const tables = rows[0]?.tables;

    if (!tables) {
      console.log(`No tables to truncate in "${name}"`);
      return;
    }

    await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    console.log(`Truncated ${tables.split(", ").length} tables in "${name}"`);
  });
}

/**
 * Clears only Better Auth's rate-limit counters, leaving seeded data alone.
 *
 * Called after global setup has signed in, so specs start with the full 3-sign-ins-per-10s
 * budget rather than the zero that setup's two sign-ins would otherwise leave. Without it a
 * retry of a login spec 429s and fails for a reason that has nothing to do with the code
 * under test.
 */
export async function resetRateLimits(): Promise<void> {
  assertTestDatabase();

  await withClient(url.toString(), async (client) => {
    await client.query('TRUNCATE "rateLimit" RESTART IDENTITY');
    console.log("Cleared rate-limit counters");
  });
}

/** Escape hatch for when migration history diverges — see db:test:reset. */
export async function dropTestDatabase(): Promise<void> {
  assertTestDatabase();

  await withClient(maintenanceConnectionString(), async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    console.log(`Dropped test database "${name}"`);
  });
}

if (import.meta.main) {
  const command = process.argv[2];

  const commands: Record<string, () => Promise<void>> = {
    create: createTestDatabase,
    truncate: truncateAll,
    "reset-rate-limits": resetRateLimits,
    drop: dropTestDatabase,
  };

  const run = command ? commands[command] : undefined;

  if (!run) {
    throw new Error(
      `Unknown command ${JSON.stringify(command)} — expected one of: ${Object.keys(commands).join(", ")}`,
    );
  }

  await run();
}
