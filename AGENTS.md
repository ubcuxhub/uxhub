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
pnpm test:rls
pnpm seed
pnpm supabase:local
pnpm types:supabase
pnpm email:templates
pnpm payment-smoke
```

`pnpm supabase:local` rebuilds the local database from scratch and seeds it (see
`supabase/README.md`). `pnpm payment-smoke` manages the production payment
smoke-test tier (see `scripts/seed/README.md`).

`pnpm test` runs the Vitest suite once (`pnpm test:watch` for watch mode). Tests are
colocated with the code they cover (e.g. `src/lib/slug.test.ts`,
`src/features/payments/schemas.test.ts`). Run a single file with
`pnpm test src/lib/slug.test.ts`, or filter by name with
`pnpm test -- -t "test name"`. CI (`.github/workflows/ci.yml`) runs `pnpm lint`,
`pnpm exec tsc --noEmit`, and `pnpm test` on every pull request and every push
to `main`.

`pnpm seed` reconciles a database to the seed data. Read `scripts/seed/README.md`
before changing it. It is idempotent, and on the default `local` target it also
deletes seed-owned rows the data no longer describes, so a ticket bought through
the UI is undone by re-running it. Pass `--no-prune` to keep those rows,
`--dry-run` to preview. Pruning deletes any event or membership tier whose slug
is not in the seed data, including one created through the admin UI, unless a
row owned by a hand-made account (a purchase, say) still references it.
Purchases and registrations are pruned only when they belong to one of the
fixture accounts, never to an account created by hand.

The eleven fixture accounts all sign in with password `123456`; see
`scripts/seed/README.md` for the membership x role grid.

`pnpm seed --target=prod` writes demo events for admins while the student-facing
events feature is unlaunched. It never deletes, never writes user fixtures, and
forces every event to `draft` so nothing fabricated is reachable through the
public API. It reads `SEED_PROD_SUPABASE_URL` and `SEED_PROD_SUPABASE_SECRET_KEY`
and expects migrations to be applied already. Each target rejects a URL that does
not match it, so a stale `.env.local` cannot silently redirect a run.

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
- `src/hooks` - shared client hooks
- `src/lib/auth` - server-side authorization guards and the client `UserProvider`
- `src/lib/supabase` - browser, server, service-role clients, generated types, and row aliases
  (`models.ts`)
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
- Card checkout is two steps: `card.tokenize()` produces the payment token, and
  `payments.verifyBuyer()` runs the issuer's Strong Customer Authentication
  challenge. Both tokens must reach `payments.create`, or cards whose issuer
  requires verification are declined.
- Prefer colocated server actions for first-party mutations. Reserve route
  handlers for callbacks, webhooks, uploads, and flows that require an HTTP
  endpoint.
- Student-facing event and checkout routes use slugs. Admin event routes use
  event IDs.
- Settings are a hash-driven dialog (`#settings/<tab>`), not standalone portal
  pages. Use `openSettings(tab)` from
  `src/features/settings/components/SettingsDialog`.
- Email markup lives in `src/lib/email`. `layout.ts` holds the shared chrome;
  `templates.ts` renders purchase receipts at request time; `auth-templates.ts`
  is the source for the Supabase auth emails. The auth templates are generated
  into `supabase/templates/*.html` by `pnpm email:templates` — edit the module,
  not the generated HTML. `pnpm test` fails when the two fall out of sync.
- Marketing typography and colors are scoped by `.marketing-home` in
  `src/app/globals.css`; keep marketing-only styles inside that boundary.
- Use the `@/*` alias for imports from `src/*`.
- Server code logs through `log` from `@/lib/log`, which emits one structured
  JSON line per event. Name events as stable dot-paths (`payment.ticket_charge_failed`),
  identify records by id, and pass errors through `errorFields` so a message can
  never carry row data. An eslint rule keeps `console` out of `src/**/*.ts`;
  client components use `console` directly.

## Database Changes

Read `supabase/README.md` before changing the schema.

- Add a new focused migration; do not edit a migration that has been applied.
- Update the matching helper and `src/lib/supabase-helpers/tables.ts`.
- Try the migration locally first with `pnpm supabase:local`.
- Apply migrations to the hosted project with `pnpm exec supabase db push`.
  Nothing applies them automatically. `pnpm types:supabase` generates types from
  the hosted project, and `/events/[slug]` is prerendered against the database
  at build time, so the push has to come before regenerating types and before
  deploying. The hosted schema then runs ahead of the deployed code, so keep
  migrations backward-compatible with the code already in production. `db push`
  is forward-only; correct a bad migration with a new one.
- Run `pnpm types:supabase` after the push and commit the regenerated
  `src/lib/supabase/database.types.ts`.
- Validate schema changes with `pnpm exec tsc --noEmit`, `pnpm lint`, and
  `pnpm build`.

## Environment

Local values belong in the git-ignored `.env.local`.

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  server-only `SUPABASE_SECRET_KEY`
- Square checkout: `NEXT_PUBLIC_SQUARE_APP_ID`,
  `NEXT_PUBLIC_SQUARE_LOCATION_ID`, and `SQUARE_ACCESS_TOKEN`
- Square webhooks: `SQUARE_WEBHOOK_SIGNATURE_KEY`; set
  `SQUARE_WEBHOOK_NOTIFICATION_URL` when the externally registered URL differs
  from the incoming request URL. When the app answers on more than one hostname,
  list one `<url>|<signature key>` pair per subscription in
  `SQUARE_WEBHOOK_ENDPOINTS`, comma-separated: Square signs each delivery with
  that subscription's own key over its own registered URL
- Email: server-only `RESEND_API_KEY`, and `EMAIL_FROM`
- Feature flags: `NEXT_PUBLIC_FEATURE_STUDENT_EVENTS` and
  `NEXT_PUBLIC_FEATURE_DARK_MODE` force a flag on or off; unset, both are on
  locally and on preview deploys and off in production (`src/lib/flags.ts`)
- Seed `prod` target: `SEED_PROD_SUPABASE_URL` and
  `SEED_PROD_SUPABASE_SECRET_KEY`

`SQUARE_ENV` is optional and defaults to the sandbox; set it to `production`
only for production credentials.

Never expose the Supabase secret keys, Square access token, webhook signature
key, or Resend API key to client components.

## Quality

- Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test` after code changes.
- Also run `pnpm build` after route, dependency, configuration, schema, or
  shared-style changes.
- Supabase RLS checks live in `supabase/tests/rls.sql` (separate from the
  Vitest suite). Run them with `pnpm test:rls`, which targets the local
  database unless `SUPABASE_DB_URL` says otherwise. The whole script runs in a
  transaction it rolls back, and every assertion is scoped to its own fixtures,
  so it is safe and repeatable against a seeded database. CI runs it in the
  build job against the throwaway database `supabase start` creates.
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
