# Helpdesk - AI-Powered Ticket Management System

## Project Overview

A ticket management system that uses AI to classify, respond to, and route support tickets. See `project-scope.md` for full requirements and `implementation-plan.md` for phased task breakdown.

## Tech Stack

- **Frontend**: React + TypeScript + Vite (port 5173) + Tailwind v4 + shadcn/ui (Base UI primitives)
- **Backend**: Express + TypeScript + Bun (port 4000)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI GPT-5 Nano via Vercel AI SDK (`@ai-sdk/openai`)
- **Auth**: Better Auth (email/password, database sessions)
- **Job Queue**: pg-boss (PostgreSQL-backed, runs in `pgboss` schema)

## Project Structure

```
/core     - Shared code (Zod schemas, types) — Bun workspace package
/client   - React frontend (Vite)
/server   - Express backend
/e2e      - Playwright harness (test-env.ts, global-setup.ts) + specs in /e2e/tests
```

## Development

```bash
# Start server
cd server && bun run dev

# Start client
cd client && bun run dev
```

The client proxies `/api/*` requests to the server via Vite config (target is configurable via `VITE_API_URL` env var, defaults to `http://localhost:4000`).

## Key Conventions

- Use Bun as the runtime and package manager (not npm/yarn)
- Use TypeScript throughout
- Use context7 MCP server to fetch up-to-date documentation for libraries
- Use shadcn/ui components for all UI (import from `@/components/ui/*`) — see **UI & Theming** below
- Import the `cn` helper from `"cn"` (shadcn's own package), not from `clsx`/`tailwind-merge`
- Use the `@/` path alias for imports (maps to `./src/`)
- Use shadcn's semantic color tokens (e.g. `bg-background`, `text-muted-foreground`, `text-destructive`) instead of hardcoded Tailwind colors
- Organize server endpoints into Express `Router` modules under `server/src/routes/` (e.g. `routes/users.ts`), mounted in `index.ts`
- Define shared Zod schemas in the `core` package under `core/schemas/` (e.g. `core/schemas/users.ts`) and import them in both client and server (e.g. `import { createUserSchema } from "core/schemas/users"`)
- Use Zod for validation (import from `zod/v4`)
- Validate request bodies in route handlers using the shared `validate` helper (`import { validate } from "../lib/validate"`). It takes a Zod schema, the request body, and the `res` object — returns `{ ok: true, data }`, or `{ ok: false }` after sending a 400 response. Bail with `if (!result.ok) return;`.
- Parse and validate numeric ID route params with the shared `parseId` helper (`import { parseId } from "../lib/parse-id"`). Returns a positive integer or `null` for invalid values.
- Do not wrap async route handlers in try/catch — Express 5 automatically catches rejected promises
- Use the shared `Role` constant instead of hardcoded `"admin"` / `"agent"` strings (import from `core/constants/role.ts`, e.g. `import { Role } from "core/constants/role.ts"`)
- Define shared constants and domain types in `core/constants/` as union types (not `enum` — the client has `erasableSyntaxOnly` enabled). Use `as const` objects when runtime access is needed (e.g. `Role`), and plain union types when only type checking is needed (e.g. `type TicketStatus = "open" | "resolved" | "closed"`).
- Use React Hook Form with Zod resolver for client-side form validation (`useForm` + `zodResolver` from `@hookform/resolvers/zod`)
- Use Axios for HTTP requests (not `fetch`)
- Use TanStack React Query (`useQuery`, `useMutation`) for server state management (not `useEffect` + `useState`)
- Use the `ErrorAlert` component for error messages (`import ErrorAlert from "@/components/ErrorAlert"`). For static messages: `<ErrorAlert message="Failed to load data" />`. For mutation/query errors with automatic Axios message extraction: `<ErrorAlert error={mutation.error} fallback="Failed to save" />`.
- Use the `ErrorMessage` component for field validation errors (`import ErrorMessage from "@/components/ErrorMessage"`): `{errors.name && <ErrorMessage message={errors.name.message} />}`

## UI & Theming

- **Install/add components with the CLI** — never hand-write files into `src/components/ui/`:
  `cd client && bunx --bun shadcn@latest add <component>`
- **Primitives are Base UI (`@base-ui/react`), not Radix.** The project was switched off `radix-ui`
  and that package has been removed — do not reintroduce it. Base UI has no `asChild`; use its
  `render` prop when you need to change the rendered element.
- **Theme is shadcn's default**: `neutral` base color, `default` radius, Geist font.
  `components.json` records this as `"style": "base-nova"`; `bunx --bun shadcn@latest preset resolve`
  prints the full preset (currently code `b2fA`).
- **`client/src/index.css`** holds the whole token set and `@import`s `tailwindcss`,
  `tw-animate-css`, `shadcn/tailwind.css`, and `@fontsource-variable/geist`. The font is bundled —
  there is no Google Fonts link in `index.html`.
- **Dark mode is defined but not wired up.** `index.css` has a complete `.dark` token block and
  `dark:` is bound to a `.dark` ancestor, but nothing toggles that class (`index.html` sets
  `class="scheme-light"`). Adding a theme toggle is all that's missing.
- **Custom app tokens** `--brand-*`, `--surface`, and `--panel` live alongside the shadcn tokens and
  are used by the sign-in/marketing surfaces (`LoginPage`, `BrandPanel`, `Logo`, `Navbar`,
  `ProtectedRoute`). These are brand blue while the shadcn primitives are neutral — an unresolved
  mismatch worth settling before building more screens.
- **Carousel**: `BrandPanel` renders shadcn's Carousel with its own arrows/dots built on the exported
  `useCarousel` hook, rather than `CarouselPrevious`/`CarouselNext` (which position themselves at the
  container edges). Listen to both `reInit` and `select` when tracking the active slide — the panel is
  `hidden lg:flex`, so embla re-measures when it first becomes visible.

## Job Queue (pg-boss)

- **Config**: `server/src/lib/queue.ts` — creates pg-boss instance using `DATABASE_URL`
- pg-boss auto-creates its own `pgboss` schema in PostgreSQL (no Prisma migration needed)
- `startQueue()` is called before `app.listen()` in the async `boot()` function in `index.ts`
- `stopQueue()` is called on `SIGTERM`/`SIGINT` for graceful shutdown
- To add a new background job: create a queue with `boss.createQueue()`, register a worker with `boss.work()` in `startQueue()`, and export a `send*Job()` function
- **Existing queues**:
  - `classify-ticket` — classifies inbound tickets via GPT (retryLimit: 3, retryDelay: 30s, exponential backoff)
  - `auto-resolve-ticket` — attempts to auto-resolve tickets via GPT; if unsuccessful, transitions status to `open`

## Ticket Lifecycle

- Inbound emails arrive via the `/api/webhooks/inbound-email` endpoint (SendGrid multipart format) and are created with status `new`
- The system enqueues `classify-ticket` and `auto-resolve-ticket` background jobs automatically
- Status flow: `new` → `processing` (AI working) → `open` (if not auto-resolved) or `resolved` (if auto-resolved)
- `new` and `processing` tickets are system-managed and never shown in the agent UI — agents only see `open`, `resolved`, and `closed` tickets
- The `/api/tickets` endpoint excludes `new` and `processing` tickets by default (no `status` filter param)

## Authentication

- **Library**: Better Auth with Prisma adapter
- **Server config**: `server/src/lib/auth.ts` — mounted at `/api/auth/{*any}` (must be before `express.json()`)
- **Client config**: `client/src/lib/auth-client.ts` — exports `signIn`, `signOut`, `useSession`
- **Middleware**: `server/src/middleware/require-auth.ts` — `requireAuth` guard that sets `req.user` and `req.session`
- **Role guard (server)**: `server/src/middleware/require-role.ts` — `requireRole(Role.Admin)`, mounted after `requireAuth` on admin-only routes. Client guards like `AdminRoute` decide what the browser shows and are not an access boundary
- **Route protection (client)**: `ProtectedRoute` component wraps authenticated routes; redirects to `/login` if unauthenticated
- **Admin route protection (client)**: `AdminRoute` component wraps admin-only routes; redirects non-admins to `/`
- **Sign-up is disabled** — users are seeded via `prisma/seed.ts`
- **User roles**: `admin` and `agent` (defined as Prisma enum, default `agent`)
- **Rate limiting**: two layers. Better Auth's own limiter covers `/api/auth/*` only — on in every environment (`rateLimit: { enabled: true }`), 3 sign-ins per 10s and 100 other auth calls per 10s, with counters in Postgres (`storage: "database"` — the `RateLimit` model) so they survive restarts and are shared across replicas. `server/src/middleware/rate-limit.ts` covers the rest: `apiLimiter` (300/min per IP on `/api`) and `authLimiter` (120/min on `/api/auth`), in-memory and per-process — burst ceilings, not credential counters. Both key on `req.ip`, and the IP Better Auth sees comes from the `x-client-ip` header `middleware/client-ip.ts` stamps, never a caller-supplied `X-Forwarded-For`. Set `TRUST_PROXY` (hop count, address list, or a preset — `true` is refused) when a proxy fronts the API

## Testing

- **Prefer component tests** for the majority of coverage (rendering, states, data display, error handling). Reserve E2E tests for things that truly need a real browser + server: navigation, auth redirects, and full-stack integration flows (e.g. webhook creates data that appears in the UI).

### Component Tests
- **Framework**: Vitest + React Testing Library
- Run with `cd client && bun run test` (single run) or `bun run test:watch` (watch mode)
- Place test files next to the component: `ComponentName.test.tsx`
- Use `renderWithQuery` from `@/test/render` to wrap components that use TanStack React Query
- Mock Axios with `vi.mock("axios")` and `vi.mocked(axios, { deep: true })`

### E2E Tests
- **Framework**: Playwright. Config at `playwright.config.ts`, specs in `e2e/tests/`
- Run with `bun run test:e2e` from root. Also `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report`
- First checkout: `docker compose up -d` then `bun run test:e2e:install` (downloads Chromium)
- Runs against a separate `helpdesk_test` database on its own ports (server 4001, Vite 5174), so it coexists with `bun run dev`. The dev database is never touched.
- Existing specs: `e2e/tests/auth-access.spec.ts` (redirects, role gating, reload persistence) and `e2e/tests/login-redirect.spec.ts` (the only form sign-in — see the budget note below)

#### Writing E2E tests — use the `e2e-test-writer` agent

**Do not hand-write specs in `e2e/tests/`.** Delegate to the `e2e-test-writer` agent
(`.claude/agents/e2e-test-writer.md`), which carries the harness constraints that are not
obvious from the code and that produce confusing failures when missed.

Invoke it with the Agent tool, `subagent_type: "e2e-test-writer"`. Give it:

- The behaviour to cover, and the routes or components involved.
- Anything already known about the surface — a new route, a new role gate, a flow that spans
  client and server.
- Whether it may touch application code (it will ask before adding a `data-testid`).

It will read the components before writing selectors, run `bun run test:e2e`, and report the
real output. Its contract requires it to prove each new test **fails when the behaviour it
covers is broken** — a test that passes against broken code is worse than none, and this
project has already had one (`toBeHidden()` racing React's first paint, which passed while
asserting nothing).

What it will refuse, correctly: rendering, display logic, component states, form validation
messages, error copy, and "was this API called". Those belong in component tests — if you
ask for one, expect it to say so rather than write a slow browser test.

Constraints it is holding, worth knowing before you brief it:

- **Sign-ins are a budget.** Better Auth allows 3 per 10s per IP, persisted in Postgres.
  Global setup clears the counter after minting its own sessions, so a run starts with all
  three, and `login-redirect.spec.ts` claims one. Every other spec uses saved sessions
  (`test.use({ storageState: STORAGE_STATE.admin })`), never a real sign-in.
- **Seeded accounts are the only accounts** — sign-up is disabled. `admin@e2e.test` and
  `agent@e2e.test`, credentials in `e2e/test-env.ts`.
- **The database resets once per run, not per test.** Specs that mutate data must clean up
  or tolerate rows left by others.
- **`workers: 1`** — one database, one dataset, one client IP.

`e2e/tests/README.md` is the short version of the same rules, for when you are reading a
spec rather than writing one.
