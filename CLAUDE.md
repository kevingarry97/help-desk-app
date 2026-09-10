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
- Use Axios for HTTP requests (not `fetch`) — via the shared instance in `client/src/lib/api.ts`, which is `baseURL: "/api"` so the Vite proxy keeps everything same-origin
- Use TanStack React Query (`useQuery`, `useMutation`) for server state management (not `useEffect` + `useState`). The `QueryClient` lives in `client/src/lib/query-client.ts` and is provided in `main.tsx`; query hooks go in `client/src/hooks/`
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

## User Management

- **Route**: `/users`, admin-only. Gated on the client by `AdminRoute` and on the server by
  `requireRole(Role.Admin)` mounted on the whole `usersRouter` — the client guard decides what
  renders, the server guard is the boundary.
- **Endpoints** (`server/src/routes/users.ts`):
  - `GET /api/users` — every user, ordered by `sortOrder` then `createdAt`.
  - `POST /api/users` — body `createUserSchema` (name, email, password, role). Creates a
    credential account through `lib/create-user.ts` and answers 201 with the new row in
    list shape. A duplicate address is a 409, checked up front and again on the unique
    index so a race answers the same way. `sortOrder` is left to its default so the new
    account lands at the end of the arranged list.
  - `PATCH /api/users/order` — body `{ ids: string[] }`, the *whole* list in its new order.
    Answers 409 if that set no longer matches the table, so a client holding a stale list
    refetches instead of writing positions for rows that no longer exist. Runs in a
    transaction that locks the user rows, so two admins reordering at once serialise.
- **Creating a user** is `client/src/components/users/CreateUserSheet.tsx` — a right-hand
  Sheet behind the "New user" button in the page header. `createUserSchema`
  (`core/schemas/users.ts`) validates on both sides, and its `.trim()`/`.toLowerCase()` on
  email mean the form's values and the API's differ: the form is typed
  `useForm<CreateUserValues, unknown, CreateUserInput>` so `handleSubmit` hands on the
  transformed output. The panel refuses to dismiss while the request is in flight.
- **`lib/create-user.ts`** (`createUserWithPassword`) is the only path that produces an
  account that can sign in — shared by the route and both seeds. It deletes the user row if
  linking the credential fails, since `internalAdapter` takes no transaction and a user
  without one can never sign in *and* holds its address against a retry.
- **`User.sortOrder`** is `Int @default(autoincrement())`, not a constant default: a user
  created after an admin has arranged the list has to land at the end of it. A reorder
  renumbers rows densely and then `setval`s the sequence past the new maximum, or the next
  insert would be handed a value from the middle of the list.
- **Drag and drop** is dnd-kit (`@dnd-kit/core`, `/sortable`, `/modifiers`, `/utilities`) in
  `client/src/components/users/`. Rows carry `data-testid="user-row"` and `data-user-id`; each
  drag handle is a button labelled `Reorder <name>`. Keyboard reordering works out of the box
  (focus a handle, Space, arrows, Space) and the announcements are overridden to say names and
  positions rather than ids.
- **`bun run db:seed:demo`** (in `server/`) fills the dev database with six demo users so the
  ordering is visible. They have no credential account and cannot sign in; remove them with
  `bun prisma/seed-demo-users.ts --clear`.

## Authentication

- **Library**: Better Auth with Prisma adapter
- **Server config**: `server/src/lib/auth.ts` — mounted at `/api/auth/{*any}` (must be before `express.json()`)
- **Client config**: `client/src/lib/auth-client.ts` — exports `signIn`, `signOut`, `useSession`
- **Middleware**: `server/src/middleware/require-auth.ts` — `requireAuth` guard that sets `req.user` and `req.session`
- **Role guard (server)**: `server/src/middleware/require-role.ts` — `requireRole(Role.Admin)`, mounted after `requireAuth` on admin-only routes. Client guards like `AdminRoute` decide what the browser shows and are not an access boundary
- **Route protection (client)**: `ProtectedRoute` component wraps authenticated routes; redirects to `/login` if unauthenticated
- **Admin route protection (client)**: `AdminRoute` component wraps admin-only routes; redirects non-admins to `/`
- **Sign-up is disabled** — the first admin is seeded via `prisma/seed.ts`, and every
  account after it is created by an admin through `POST /api/users`
- **User roles**: `admin` and `agent` (defined as Prisma enum, default `agent`)
- **Rate limiting**: two layers. Better Auth's own limiter covers `/api/auth/*` only — on in every environment (`rateLimit: { enabled: true }`), 3 sign-ins per 10s and 100 other auth calls per 10s, with counters in Postgres (`storage: "database"` — the `RateLimit` model) so they survive restarts and are shared across replicas. `server/src/middleware/rate-limit.ts` covers the rest: `apiLimiter` (300/min per IP on `/api`) and `authLimiter` (120/min on `/api/auth`), in-memory and per-process — burst ceilings, not credential counters. Both key on `req.ip`, and the IP Better Auth sees comes from the `x-client-ip` header `middleware/client-ip.ts` stamps, never a caller-supplied `X-Forwarded-For`. Set `TRUST_PROXY` (hop count, address list, or a preset — `true` is refused) when a proxy fronts the API

## Testing

- **Prefer component tests** for the majority of coverage (rendering, states, data display, error handling). Reserve E2E tests for things that truly need a real browser + server: navigation, auth redirects, and full-stack integration flows (e.g. webhook creates data that appears in the UI).

### Component Tests
- **Framework**: Vitest + React Testing Library. Config in `client/vitest.config.ts`, which extends the app's Vite config so `@/…` and the `core` package resolve exactly as they do in the bundler
- Run with `bun run test:component` from the root (`test:component:watch` for watch mode). Inside `client/`, `bun run test` / `test:watch` / `test:component` do the same thing
- Run a single file with `bun run test:component src/pages/LoginPage.test.tsx`, or filter by name with `-t "validation"`
- Place test files next to the component: `ComponentName.test.tsx`

#### Writing component tests

**Write these yourself — there is no agent for them.** `e2e-test-writer` is Playwright-only
and will refuse; asking it for a component test gets you a browser test you did not want.

This is where the majority of coverage belongs: rendering, every state a component can be
in, data display, form validation, and error handling. Reach for E2E only when a real
browser and a real server are the point.

**Test helpers** live in `client/src/test/`:

- `renderWithQuery` (`@/test/render`) — renders inside a fresh `QueryClientProvider` with
  retries off, so an error state shows on the first rejection. `createQueryWrapper` returns
  the client and wrapper separately for `renderHook`.
- `makeUser` / `makeUsers` (`@/test/fixtures`) — build `UserListItem`s with every field
  defaulted, so a test names only what it is about. `makeUsers` assigns `id` and `sortOrder`
  by position.
- `setup.ts` stubs `matchMedia`, `IntersectionObserver`, `ResizeObserver` and
  `PointerEvent`. jsdom has none. The first three are for embla (behind `BrandPanel`, which
  `LoginPage` renders), which crashes without them; `PointerEvent` is for Base UI's Radio,
  which re-dispatches a click as one and would otherwise throw before the radio ever
  checks.

**Mocking, in order of preference — mock the boundary, not the app:**

- **Axios**: `api.ts` calls `axios.create()` at import time, so the instance must exist
  before the module graph evaluates. Use a factory, not automocking:
  ```ts
  vi.mock("axios", () => {
    const instance = { get: vi.fn(), patch: vi.fn() };
    return { default: { create: vi.fn(() => instance) } };
  });
  const api = vi.mocked(axios, { deep: true }).create();
  ```
- **Auth**: `vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn(), signOut: vi.fn() }))`.
  Drive the session states — pending, anonymous, agent, admin — rather than the components
  that read them.
- **Routing**: do *not* mock. Wrap in `MemoryRouter` with real `Routes`, and assert on the
  heading the destination renders. A spy on `useNavigate` drifts from what react-router
  actually does with `replace`, state, and guards.

**Querying**: `getByRole`, `getByLabelText`, `getByText`. Never CSS classes — this project
restyles often. When an element has no role or text (the loading skeleton), query the
component's `data-slot` contract (`[data-slot="skeleton"]`), not its Tailwind classes.

**The trap that has bitten this codebase twice:** a negative assertion passes before the
component has rendered. `toBeHidden()` and `queryBy…not.toBeInTheDocument()` are both
satisfied by an element that does not exist *yet*, so a test can pass while asserting
nothing. Always assert something positive first — await a heading, a button, a row count —
then assert the absence. Same trap in a nested guard: an `AdminRoute` loading test mounted
under `ProtectedRoute` passes on the outer spinner even with `AdminRoute`'s branch deleted,
so mount the component under test in isolation.

**Verify a new test by breaking what it covers.** Invert the condition in the component,
confirm the test goes red, restore. A test that stays green against broken code is worse
than none. This has caught two vacuous tests here — both looked correct on review.

**Cover every state a component can be in**, not just the happy one: loading/skeleton,
empty, error, and the disabled or in-flight variants. Those branches are where the bugs are
and they are cheap to reach with a mock.

**Existing suites** (91 tests): `LoginPage` (inputs, validation, submit, redirects),
`UserRow`, `UsersPage`, `ErrorAlert`, `ProtectedRoute` (covers `AdminRoute`), `Navbar`,
`UsersTable`, `CreateUserSheet`, `use-users`, `lib/reorder`.

**Deliberately untested**: `Logo`, `AppLayout`, `RouteSpinner`, `ErrorMessage` — presentational
with no branching, so a test would restate the JSX. `BrandPanel` needs real layout. `HomePage`
renders placeholders until it is wired to data.

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
