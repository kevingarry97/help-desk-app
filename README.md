# Help Desk

Two folders, no monorepo tooling.

```
client/    React 19 + TypeScript (Vite)
server/    Express 5 + TypeScript (Bun)
```

Each folder is self-contained: its own `package.json`, its own `node_modules`,
its own install.

## Running it

Install once per folder:

```sh
cd server && bun install
cd ../client && bun install
```

Then run each in its own terminal:

```sh
cd server && bun run dev     # http://localhost:4000
cd client && bun run dev     # http://localhost:5173
```

Open http://localhost:5173 — the page calls the API and shows its health.

## The health route

```
GET /api/health  →  { "status": "ok", "uptime": 12.34 }
```

The client fetches `/api/health` (no host), and Vite proxies `/api` to
`http://localhost:4000`. The browser only ever talks to one origin, so there is
no CORS setup to get wrong.

## Notes

**The server listens on 4000, not 3000.** Port 3000 on this machine is already
held by `rsbuild-node` processes, and so is 3001. Override with `PORT=5000 bun run dev` if you
need something else — the proxy target in `client/vite.config.ts` has to match.

**Vite runs under Bun** (`bunx --bun vite`). Vite 8 wants Node 20.19+ and this
machine has 20.18.2, so running it on Bun avoids a Node upgrade.

## Scripts

Both folders have `typecheck`. The client also has `build` and `preview`; the
server has `start` for running without hot reload.
