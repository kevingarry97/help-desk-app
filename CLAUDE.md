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
- Validate request bodies in route handlers using the shared `validate` helper (`import { validate } from "../lib/validate"`). It takes a Zod schema, the request body, and the `res` object — returns `{ ok: true, data }`, or `{ ok: false }` after sending a 400 response. Bail with `if (!result.ok) return;`. Validate query strings with the same helper and a fourth argument: `validate(schema, req.query, res, "query")`, which answers "Invalid query parameters" instead of "Invalid request body". It is the only place a validation 400 is shaped — never call `schema.safeParse(req.body)` or `schema.safeParse(req.query)` and write the 400 yourself.
- Read secret environment variables with the shared `readSecret` helper (`import { readSecret } from "../lib/env"`), never `process.env.X` plus a hand-written length check. Call it at module load so bad config fails at boot. `readSecret("NAME", { required: true })` returns a `string` and throws if the variable is unset, empty, or shorter than 32 characters (`MIN_SECRET_LENGTH`). Without `required`, unset or empty returns `undefined` — treat that as the feature being off (e.g. the inbound email webhook answers 503) — but a set-and-short value still throws. Checks specific to one secret stay beside the call (e.g. `lib/auth.ts` refusing Better Auth's published default).
- Parse and validate numeric ID route params with the shared `parseId` helper (`import { parseId } from "../lib/parse-id"`). Returns a positive integer or `null` for invalid values.
- Do not wrap async route handlers in try/catch — Express 5 automatically catches rejected promises and forwards them to `errorHandler` (`server/src/middleware/error-handler.ts`). That includes errors you expect: a Prisma unique violation (P2002) is answered there as a 409, so let it throw. Handle the ordinary case with a check up front when the response should say something specific (e.g. `POST /api/users` answers a known duplicate email by name)
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
- **Ticket colour tokens**, all defined in both `:root` and `.dark`:
  - `--status-{open,resolved,closed}` (amber, green, slate) with `-foreground` and `-accent`. Open is
    deliberately not brand blue, which already means "link" and "selected".
  - `--category-{general,technical,refund}` (violet, cyan, rose) with `-foreground` and `-accent`,
    kept clear of the status hues.
  - `--table-{header,header-foreground,stripe,row-hover,muted-foreground}` for data tables.
  - `--surface-muted-foreground` for secondary text on the `--surface` canvas.

  Every text pair clears 4.5:1 (most 6:1+) and every accent 3:1 against the card. **Don't use
  `text-muted-foreground` on a tint or on `--surface`**: the shadcn default falls to ~4.3–4.4:1 there;
  use the table/surface muted tokens. Status marks are round dots, category marks are squares — keep
  that distinction. Add a full set in both blocks for any new status or category, and check the
  contrast numbers rather than eyeballing them.
- **Narrow screens**: check new pages at 400px wide for horizontal overflow. The navbar hides the
  logo's wordmark below `sm` (`<Logo wordmarkClassName="hidden sm:inline" />`) because an admin's
  two nav links push Sign out off-screen otherwise — recheck if you add a nav link.
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

## Inbound Email

- **No mail provider is chosen yet.** `POST /api/webhooks/inbound-email` (`server/src/routes/webhooks.ts`)
  takes a provider-neutral JSON email — `inboundEmailSchema` in `core/schemas/inbound-email.ts`:
  `{ from, subject?, text?, html?, messageId? }`, where `from` is the raw From header value. Wiring
  up SendGrid, Mailgun, Postmark or a relay later means an adapter that produces this shape (and
  that provider's signature check), in front of the same code.
- **Auth** is `Authorization: Bearer <INBOUND_EMAIL_SECRET>` (`middleware/require-inbound-secret.ts`),
  checked before the body is read. Unset means the endpoint answers 503; set but under 32 chars
  refuses to boot. Status codes follow provider retry semantics — providers retry 5xx and drop 4xx —
  so "not configured" and database failures get redelivered and forged or malformed requests do not.
- **Mounted above the app-wide `express.json()`** in `index.ts`, with its own 2mb parser. Its 100kb
  default would 413 an ordinary HTML email.
- **`lib/inbound-email.ts` (`toTicketData`)** never refuses an email for its content: a blank subject
  or body becomes a placeholder, text is preferred over HTML (stripped by `htmlToText`), the body is
  cut at 50,000 chars with a marker. Only an unusable `from` address is a 400.
- **De-duplication**: `Ticket.messageId` is unique, stored without `<>`. A redelivered email answers
  200 `{ id, duplicate: true }` with the existing ticket; a race meets the index and gets a 409.
- Emailed tickets are created `OPEN` (the column default). Every email is a new ticket — replies are
  not threaded onto existing ones yet.
- **Try it locally**: set `INBOUND_EMAIL_SECRET` in `server/.env`, run the server, then
  `cd server && bun run email:test` (flags: `--from`, `--subject`, `--text`, `--html`, `--message-id`).

## Tickets (list, filters, detail)

- **Routes**: `/tickets` (`client/src/pages/TicketsPage.tsx`) and `/tickets/:id`
  (`TicketDetailPage.tsx`), for every signed-in user — agents manage tickets, so both sit under
  `ProtectedRoute` only, not `AdminRoute`. The navbar's "Tickets" link is shown to everyone;
  "Users" stays admin-only.
- **List endpoint**: `GET /api/tickets` answers the list shape — `TICKET_LIST_SELECT`
  (`server/src/lib/ticket-select.ts`), mirrored by `ticketListItemSchema` / `TicketListItem` in
  `core/schemas/tickets.ts`: `id, subject, requesterEmail, status, category, createdAt`. **No
  `body`** (an emailed body runs to 50,000 characters) and no `messageId`. Keep each server select
  and its core schema in step, the same way `USER_LIST_SELECT` mirrors `userListItemSchema`.
- **The table is TanStack Table v9 (`@tanstack/react-table`), in manual mode — the server sorts and
  filters.** `TicketsPage` builds it with `useTable` (v9: `tableFeatures`, not `useReactTable` /
  `getCoreRowModel`); features and columns live in `components/tickets/ticket-columns.tsx`
  (`rowSortingFeature`, `columnFilteringFeature`, `globalFilteringFeature`,
  `columnVisibilityFeature`, typed `tableMeta`/`columnMeta`). **The URL is the only state**: sorting,
  column filters (`status`, `category`) and the global filter (`q`) are derived from
  `useSearchParams` on every render (`lib/ticket-table-state.ts`), and every `on*Change` maps the
  updated state straight back into the URL. Filter chips and search call
  `column.setFilterValue` / `table.setGlobalFilter`, never the URL directly — except "Clear filters",
  which writes the URL once because two `setSearchParams` calls in one tick overwrite each other.
  `status` is a hidden column (`HIDDEN_TICKET_COLUMNS`) that exists only to hold the status filter.
  No sorted or filtered row models are registered, so rows always render in server order.
- **Sorting is server-side**: `?sort=createdAt|subject|category&dir=asc|desc`, ordered by
  `ticketListOrderBy` (`server/src/lib/ticket-order.ts`, unit-tested) with `createdAt desc, id desc`
  breaking ties. A column's first direction (dates newest first, text A–Z) is
  `TICKET_SORT_FIRST_DIRECTION` in `core/constants/ticket.ts`, shared by the server default and the
  columns' `sortDescFirst` — change it there, not in either place alone. The default sort (Received,
  newest first) is written as no parameters. `enableMultiSort` and `enableSortingRemoval` are off —
  one sort, always. **Category sorts by the Postgres enum's declaration order** (General, Technical,
  Refund — the order the filters use), not alphabetically by label. Header cells carry `aria-sort`;
  the sort buttons are hidden with the header row below `sm`.
- **Filters and search are server-side and live in the URL.** `?status=`, `?category=` and `?q=` are
  validated by `ticketListQuerySchema` (`validate(…, req.query, res, "query")`) and turned into the
  Prisma `where` by `ticketListWhere` (`server/src/lib/ticket-where.ts`, unit-tested): exact status
  and category, and for a non-blank `q` a case-insensitive match on subject or requester email, plus
  the end of the id when `q` looks like a reference (`#K3F9QZ` or `k3f9qz`). An unknown status or
  category, or a `q` over 200 chars, is a 400. On the client, `lib/ticket-filters.ts` reads them from
  `useSearchParams` (an unknown value there counts as "All", so a stale link still shows a list) and
  writes them back with `replace`. `TicketSearch.tsx` keeps the typed draft locally and applies it
  after a 300ms pause (one request per pause, not per keystroke); a change from outside — "Clear
  filters", Back — replaces the draft. `TicketFilters.tsx` is two shadcn ToggleGroups (Base UI) — chosen
  over a Select because Base UI popups are a Vitest hazard (see Component Tests). Base UI emits `[]`
  when the pressed item is clicked again; that and "All" both mean no filter. Each filter
  combination (and each sort) is its own query (`["tickets", "list", query]`) with `keepPreviousData`, so the old
  rows stay on screen, dimmed and `aria-busy`, while a new filter loads. A filter that matches
  nothing shows "No tickets match these filters" with "Clear filters" (which clears the search too,
  and keeps the sort), distinct from "No tickets yet".
- **The list is grouped by status**: `TicketsTable` renders a `<section aria-label="Open tickets"
  data-testid="ticket-group">` per status in `TICKET_STATUS_LABEL` order (Open, Resolved, Closed),
  each headed by a collapse button named like "Open, 3 tickets" (disabled at 0) and holding its own
  table. Rows keep the server's order within a section; a `?status=` filter shows only
  that section. The tables are `table-fixed` with fixed side-column widths so sections line up — keep
  widths in the column's `meta.className` if you add one. Columns: Ref (sm+), Ticket, Category (lg+),
  Received (md+); the header row is hidden below `sm`, where only Ticket remains.
- **References**: `ticketReference(id)` (`lib/ticket-reference.ts`) is `#` plus the id's last six
  characters, upper-cased — tickets have no sequential number. It is shown on rows and the detail
  page, and `?q=` matches it. It is a display handle, not a unique key.
- **Detail endpoint**: `GET /api/tickets/:id` answers `TICKET_DETAIL_SELECT` / `ticketDetailSchema`
  — the list shape plus `body` and `updatedAt`, still no `messageId` — or 404. `useTicket(id)`
  caches under `["tickets", "detail", id]`, so invalidating `ticketsQueryKey` refreshes lists and
  open tickets alike. `queryClient` does not retry a 404 (nor 401/403).
- **Detail page**: a 404 shows "Ticket not found"; any other failure is an `ErrorAlert`. The body is
  plain text rendered with `whitespace-pre-wrap break-words` — never as HTML. "All tickets" returns
  to the list's filters: each row's link passes `state={{ listSearch }}`, and the page only trusts a
  string starting with `?` (router state survives a reload and could hold anything).
- **Rows open on click anywhere**: the subject is the row's one `<Link>`, and its `::after` is
  stretched over the `relative` row. Don't add a row `onClick` or a second link — this keeps one
  named link per row for keyboard and screen-reader users.
- **Labels and colours**: stored values (`OPEN`, `TECHNICAL_QUESTION`) are never shown raw. Display
  names live in `client/src/lib/ticket-labels.ts`; every status and category class string lives in
  `components/tickets/ticket-style.ts` (`STATUS_STYLE`, `CATEGORY_STYLE`, `STATUS_HEADING`). Render
  them through `TicketStatusBadge` and `TicketCategoryTag` — don't build a status `Badge` or category
  chip inline. All are full `Record`s, so a new status or category fails the typecheck until it has
  a label and colours.
  Dates go through `formatDateTime` (`lib/format-date.ts`) inside a `<time dateTime>`.
- **Not built yet**: pagination (the list returns every matching ticket, so every section's count is
  a full count), a sort control on phones (headers are hidden below `sm`), changing status or
  assigning from the detail page, and replies.

## Ticket Lifecycle (planned — not built)

The AI pipeline below does not exist yet: there is no pg-boss queue, no AI SDK, and `TicketStatus`
is only `OPEN | RESOLVED | CLOSED`. When it is built, emailed tickets move to being created as `new`:

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
    list shape. A duplicate address is a 409, checked up front (with the address named in
    the message) and again on the unique index — a race lets the violation throw, and
    `errorHandler` answers it as a plain 409 `Conflict`. `sortOrder` is left to its default so the new
    account lands at the end of the arranged list.
  - `PATCH /api/users/order` — body `{ ids: string[] }`, the *whole* list in its new order.
    Answers 409 if that set no longer matches the table, so a client holding a stale list
    refetches instead of writing positions for rows that no longer exist. Runs in a
    transaction that locks the user rows, so two admins reordering at once serialise.
  - `PATCH /api/users/:id` — body `updateUserSchema` (name, email, role — `createUserSchema`
    without the password; there is no way to change a password yet). Answers the updated row
    in list shape. 403 if an admin tries to take away their own admin role, 409 (named) if
    the email belongs to someone else, 404 if the user is gone.
  - `DELETE /api/users/:id` — 204. Sessions and the credential account go with the row
    (`onDelete: Cascade`). 403 if an admin tries to delete themselves, 404 if already gone.
  - Both run in a `$transaction` that locks the target and every admin row
    (`lockUserAndAdmins`) and refuse with 409 if the change would leave no admin. With the
    self-guards that can only happen when two admins demote or delete each other at the same
    moment; the lock makes the second request see the first one's result.
- **Creating a user** is `client/src/components/users/CreateUserSheet.tsx` — a right-hand
  Sheet behind the "New user" button in the page header. `createUserSchema`
  (`core/schemas/users.ts`) validates on both sides, and its `.trim()`/`.toLowerCase()` on
  email mean the form's values and the API's differ: the form is typed
  `useForm<CreateUserValues, unknown, CreateUserInput>` so `handleSubmit` hands on the
  transformed output. The panel refuses to dismiss while the request is in flight.
- **Editing and deleting**: each row has an `Edit <name>` button that opens
  `EditUserSheet.tsx`. **Delete user** lives in that sheet's footer and opens
  `DeleteUserDialog.tsx` (an AlertDialog) to confirm. On the signed-in admin's own account the
  role picker is disabled and Delete is not offered — `UsersPage` compares against
  `useSession()`; the server enforces the same rules. Both panels refuse to dismiss while
  their request is in flight. The role picker is shared with the create sheet
  (`RoleRadioGroup.tsx`).
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
- **`bun run db:seed:demo:tickets`** (in `server/`) fills the dev database with 32 realistic tickets
  across every status and category, spread over five weeks. Re-runnable (keyed by a
  `demo-ticket-N@demo.helpdesk.local` Message-ID); remove them with
  `bun prisma/seed-demo-tickets.ts --clear`. Refuses to run with `NODE_ENV=production`.

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

### Server Unit Tests
- **Framework**: Bun's built-in `bun test` (`import { describe, expect, test } from "bun:test"`) — no dependency, no config
- Run with `bun run test:server` from the root, or `bun run test` inside `server/` (`bun test src/lib/inbound-email.test.ts` for one file)
- For **pure server logic** — parsing, normalization, guards' decision functions. Place test files next to the module: `module-name.test.ts`
- Keep the logic worth testing in exported pure functions (e.g. `secretMatches` beside `requireInboundSecret`) rather than testing Express handlers or Prisma calls here; routes and the database are covered by E2E
- Bun loads `server/.env` for tests too, so a module that validates env at import (like `require-inbound-secret.ts`) sees your local values
- The same rule as component tests applies: break what a new test covers, see it go red, restore

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
- **Base UI's Menu (shadcn `dropdown-menu`) hangs Vitest under jsdom.** Once the menu opens,
  something spins synchronously, so no test timeout fires and the run never ends
  (`modal={false}` doesn't help). `userEvent.click` doesn't open it at all. That is why the
  user rows use plain buttons; if you need a menu, fix or mock this first.

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

**Existing suites** (217 tests): `LoginPage` (inputs, validation, submit, redirects),
`UserRow`, `UsersPage`, `ErrorAlert`, `ProtectedRoute` (covers `AdminRoute`), `Navbar`,
`UsersTable`, `CreateUserSheet`, `EditUserSheet`, `DeleteUserDialog`, `use-users`,
`lib/reorder`, `TicketsPage` (covers `TicketsTable`, `TicketFilters`, `TicketSearch` and
`use-tickets`, and TanStack sorting/filtering end to end with a mocked API), `TicketDetailPage`,
`lib/ticket-filters`, `lib/ticket-table-state`, `lib/ticket-reference`, `lib/query-client` (the
retry policy). Ticket rows carry
`data-testid="ticket-row"` and `data-ticket-id`; `makeTicket` / `makeTickets` / `makeTicketDetail`
in `@/test/fixtures` build ticket data the same way `makeUser` does.

**Pages that read the URL need a real router in tests.** `TicketsPage` and `TicketDetailPage` render
inside `MemoryRouter` with real `Routes`; to assert what a page wrote to the URL, or where a link
went, mount a small probe component on the route that renders `useLocation()` (see
`TicketsPage.test.tsx`), rather than mocking `useSearchParams` or `useNavigate`.

**Base UI's ToggleGroup is safe under jsdom** (unlike its Menu): `userEvent.click` toggles it, and
buttons are queryable by `getByRole("button", { name, pressed })` inside
`getByRole("group", { name })`.

**Collapsed content is `hidden`, which takes it out of the accessibility tree**: `getByRole` will
not find a link in a collapsed ticket section at all. Assert a collapsed row with
`getByText(…)` + `not.toBeVisible()`, after a positive assertion on the button's `expanded` state.

**Deliberately untested**: `Logo`, `AppLayout`, `RouteSpinner`, `ErrorMessage` — presentational
with no branching, so a test would restate the JSX. `BrandPanel` needs real layout. `HomePage`
renders placeholders until it is wired to data.

### E2E Tests
- **Framework**: Playwright. Config at `playwright.config.ts`, specs in `e2e/tests/`
- Run with `bun run test:e2e` from root. Also `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report`
- First checkout: `docker compose up -d` then `bun run test:e2e:install` (downloads Chromium)
- Runs against a separate `helpdesk_test` database on its own ports (server 4001, Vite 5174), so it coexists with `bun run dev`. The dev database is never touched.
- Existing specs: `e2e/tests/auth-access.spec.ts` (redirects, role gating, reload persistence) and `e2e/tests/login-redirect.spec.ts` (the only form sign-in — see the budget note below), and
  `e2e/tests/inbound-email.spec.ts` (webhook → ticket through the API: bearer secret, the router's
  mount above `express.json()`, Message-ID de-duplication). The harness passes `INBOUND_EMAIL_SECRET`
  from `e2e/test-env.ts`. `e2e/tests/tickets-list.spec.ts` covers the navbar route to `/tickets` and
  emailed tickets showing newest first; `tickets-filters.spec.ts` the server-side status/category
  narrowing, reload persistence and the 400; `tickets-detail.spec.ts` opening a row by clicking
  anywhere on it, the return to the filtered list, the 404 page and the detail JSON shape;
  `tickets-search.spec.ts` subject/email/reference search on real Postgres and its 400;
  `tickets-sort.spec.ts` server-side sorting by subject and received, reload persistence, category
  enum order and the 400s. **A server that ignored `?status=` would look identical in the browser**
  — sections group rows by status on the client — so status filtering is proved through the API
  response, not the page. Specs create tickets through `createTicketByApi` in `e2e/helpers.ts`.
- **The `request` fixture inherits `test.use({ storageState })`**, not just `page` — a request made
  inside a signed-in describe carries the session cookie. A "no session" API test must live outside
  any `storageState` block (see the top-level describe in `auth-api.spec.ts`).

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
