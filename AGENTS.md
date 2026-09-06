# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

UX Hub is a single Next.js App Router application at the repository root. It
contains:

- Public marketing pages at `/` and `/events/*`
- Auth flows under `/auth/*`
- Authenticated student pages under `/portal/*`
- Admin-only pages under `/admin/*`
- Integration and upload handlers under `/api/*`

The app uses Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase, Square,
shadcn-style UI primitives, and the React Compiler.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm start
pnpm seed
pnpm types:supabase
pnpm email:templates
```

`pnpm test` runs the Vitest suite once (`pnpm test:watch` for watch mode). Tests are
colocated with the code they cover (e.g. `src/lib/slug.test.ts`,
`src/features/payments/schemas.test.ts`). Run a single file with
`pnpm test src/lib/slug.test.ts`, or filter by name with
`pnpm test -- -t "test name"`. CI (`.github/workflows/ci.yml`) runs `pnpm lint`,
`pnpm exec tsc --noEmit`, and `pnpm test` on every push and pull request.

`pnpm seed` is idempotent and supplies local sample memberships and events.
Use `pnpm seed -- --dry-run` to preview it. It refuses non-local Supabase
targets unless explicitly passed `--allow-remote`.

## Architecture

- `src/app` - routes and layouts
  - `(marketing)` - public marketing and event pages
  - `(auth)/auth` - login, sign-up, confirmation, profile completion, and
    password recovery
  - `(app)` - shared authenticated boundary and `UserProvider`
    - `(shell)` - sidebar-backed student and admin pages
    - `(confirmation)` - sidebar-free, full-viewport post-purchase pages
  - `@flow` - parallel slot holding intercepted `(.)portal/*` routes
  - `api` - Square webhook, profile-completion, and event-image upload handlers
- `src/features` - domain UI and behavior
  - `admin`, `auth`, `events`, `marketing`, `memberships`, `payments`, and
    `settings`
- `src/components/ui` - shared shadcn-style primitives
- `src/components/shared` - shared application composites
- `src/lib/auth` - server-side authorization guards
- `src/lib/supabase` - browser, server, service-role clients, and generated types
- `src/lib/supabase-helpers` - typed domain data-access helpers
- `src/lib/square` - server-only Square configuration and client
- `src/proxy.ts` - Supabase session refresh for matched requests
- `scripts/seed` - local sample-data reconciliation
- `supabase/migrations` - versioned database migrations

## Important Patterns

- `src/proxy.ts` refreshes sessions for `/portal/*`, `/admin/*`, and `/api/*`;
  it does not authorize users.
- `src/app/(app)/layout.tsx` calls `requireAuth()` and provides the current user.
  `src/app/(app)/(shell)/admin/layout.tsx` adds `requireAdmin()`. Keep access
  control in these server-side guards rather than relying on client UI.
- Route groups determine chrome without changing URLs: browsing pages live in
  `(shell)`, and post-purchase confirmations live in `(confirmation)`, which
  drops the sidebar to fill the viewport.
- Membership onboarding and checkout render in a dialog, and each of their
  pages exists twice: canonically under
  `(shell)/portal/membership/*` (direct navigation and refreshes) and
  intercepted under `@flow/(.)portal/membership/*` (soft navigation from within
  the app). Both layouts wrap children in `MembershipFlowDialog`, differing only
  by `mode`. Add a page to one tree and you must add it to the other; put shared
  behavior in the feature component so both pick it up.
- Prefer the typed helpers in `src/lib/supabase-helpers` over scattering raw
  `.from(...)` calls. Use `TABLES` for table names. Keep RLS-bypassing
  service-role work server-only in `src/lib/supabase/admin.ts` and
  `admin-server.ts`.
- Prefer colocated server actions for first-party mutations. Reserve route
  handlers for callbacks, webhooks, uploads, and flows that require an HTTP
  endpoint.
- Student-facing event and checkout routes use slugs. Admin event routes use
  event IDs.
- Settings are a hash-driven dialog (`#settings/<tab>`), not standalone portal
  pages. Use `openSettings(tab)` from `src/features/settings`.
- Email markup lives in `src/lib/email`. `layout.ts` holds the shared chrome;
  `templates.ts` renders purchase receipts at request time; `auth-templates.ts`
  is the source for the Supabase auth emails. The auth templates are generated
  into `supabase/templates/*.html` by `pnpm email:templates` — edit the module,
  not the generated HTML. `pnpm test` fails when the two fall out of sync.
- Marketing typography and colors are scoped by `.marketing-home` in
  `src/app/globals.css`; keep marketing-only styles inside that boundary.
- Use the `@/*` alias for imports from `src/*`.

## Database Changes

Read `supabase/README.md` before changing the schema.

- Add a new focused migration; do not edit a migration that has been applied.
- Update the matching helper and `src/lib/supabase-helpers/tables.ts`.
- Run `pnpm types:supabase` after schema changes and commit the regenerated
  `src/lib/supabase/database.types.ts`.
- Validate schema changes with `pnpm exec tsc --noEmit`, `pnpm lint`, and
  `pnpm build`.
- Apply migrations to the hosted project with `npx supabase db push` before
  deploying a branch that adds them. Nothing applies them automatically, and
  `/events/[slug]` is prerendered against the database at build time, so a
  deploy fails until the migrations land. `db push` is forward-only; correct a
  bad migration with a new one.

## Plans

Read `docs/designs/README.md` before drafting or implementing an in-repo plan.

## Environment

Local values belong in the git-ignored `.env.local`.

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  server-only `SUPABASE_SECRET_KEY`
- Square checkout: `NEXT_PUBLIC_SQUARE_APP_ID`,
  `NEXT_PUBLIC_SQUARE_LOCATION_ID`, and `SQUARE_ACCESS_TOKEN`
- Square webhooks: `SQUARE_WEBHOOK_SIGNATURE_KEY`; set
  `SQUARE_WEBHOOK_NOTIFICATION_URL` when the externally registered URL differs
  from the incoming request URL

`SQUARE_ENV` is optional and defaults to the sandbox; set it to `production`
only for production credentials.

Never expose the Supabase secret key, Square access token, or webhook signature
key to client components.

## Quality

- Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test` after code changes.
- Also run `pnpm build` after route, dependency, configuration, schema, or
  shared-style changes.
- Supabase RLS checks live in `supabase/tests/rls.sql` (separate from the
  Vitest suite).
- Do not verify changes by driving the app in a browser unless you are
  explicitly asked to. Never sign in, and never type credentials — including
  the local seed passwords in `scripts/seed/data/users.ts` — into a form. Take
  automated verification as far as it goes (lint, types, Vitest, `pnpm build`,
  direct `psql` queries), then hand the reviewer a list of what still needs
  checking by hand and why.

## UI

Reuse `src/components/ui` primitives and `src/components/shared` composites
before adding new primitives. Follow the existing shadcn conventions and use
design tokens from `src/app/globals.css` instead of duplicating one-off styles.

