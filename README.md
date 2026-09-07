# Help Desk

Two folders, no monorepo tooling.

```
client/            React 19 + TypeScript (Vite)
server/            Express 5 + TypeScript (Bun) + Prisma 7
docker-compose.yml PostgreSQL 17
```

Each folder is self-contained: its own `package.json`, its own `node_modules`,
its own install.

## Running it

Start the database first:

```sh
docker compose up -d
```

Install once per folder:

```sh
cd server && bun install && cp .env.example .env
cd ../client && bun install
```

Apply migrations (first run only):

```sh
cd server && bunx --bun prisma migrate dev
```

Then run each in its own terminal:

```sh
cd server && bun run dev     # http://localhost:4000
cd client && bun run dev     # http://localhost:5173
```

Open http://localhost:5173 — the page calls the API and shows its health.

## API

```
GET   /api/health       → { status, uptime, database: "connected" }
GET   /api/tickets      → Ticket[]
POST  /api/tickets      → creates one (subject, body, requesterEmail, category?)
PATCH /api/tickets/:id  → { status: OPEN | RESOLVED | CLOSED }
```

`/api/health` runs `SELECT 1` against Postgres, so it reports `503` /
`"database": "unreachable"` if the container is down — it proves the database is
reachable, not just that the process is up.

The client fetches `/api/health` (no host), and Vite proxies `/api` to
`http://localhost:4000`. The browser only ever talks to one origin, so there is
no CORS setup to get wrong.

## Database

PostgreSQL 17 runs in Docker (`docker compose up -d`), mapped to host port
**5433** — port 5432 is already taken by your `superset-db-1` container.

Prisma 7 differs from v6 in three ways worth knowing:

- The `generator` block requires an explicit `output`; the client is generated
  as TypeScript into `server/generated/prisma` (gitignored) rather than into
  `node_modules/@prisma/client`.
- The `datasource` block has **no `url`**. The connection string lives in
  `prisma.config.ts`, read from `DATABASE_URL`.
- `PrismaClient` needs a **driver adapter** (`@prisma/adapter-pg` over `pg`)
  instead of a bundled query-engine binary. See `server/src/db.ts`.

Useful commands (all from `server/`):

```sh
bunx --bun prisma migrate dev --name <name>   # change schema + apply
bunx --bun prisma studio                      # browse data
bunx --bun prisma generate                    # regenerate client
docker compose down -v                        # reset the database entirely
```

## Notes

**Prisma runs under Bun**, not Node. `prisma@latest` is currently an 8.0.0
release candidate while `@prisma/client@latest` is stable 7.10.0, so both are
pinned to `7.10.0` — do not install these with `@latest` or they will mismatch.
Prisma's installer also hard-blocks on Node 20.18.2 (it wants 20.19+), which is
why deps were added with `--ignore-scripts`.

**The server listens on 4000, not 3000.** Port 3000 on this machine is already
held by `rsbuild-node` processes, and so is 3001. Override with `PORT=5000 bun run dev` if you
need something else — the proxy target in `client/vite.config.ts` has to match.

**Vite runs under Bun** (`bunx --bun vite`). Vite 8 wants Node 20.19+ and this
machine has 20.18.2, so running it on Bun avoids a Node upgrade.

## Scripts

Both folders have `typecheck`. The client also has `build` and `preview`; the
server has `start` for running without hot reload.
