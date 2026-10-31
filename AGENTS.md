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
pnpm test:integration
pnpm seed
pnpm supabase:local
pnpm types:supabase
pnpm email:templates
pnpm payment-smoke
```

`pnpm supabase:local` rebuilds the local database from scratch and seeds it (see
`supabase/README.md`). `pnpm payment-smoke` manages the production payment
smoke-test tier (see `scripts/seed/README.md`).

`pnpm test:integration` runs the Vitest integration suite
(`*.integration.test.ts`) against the local Supabase, reading its credentials
from `supabase status`. It refuses any host that is not local, because it writes
and deletes with the service-role key. Each test tags its fixtures and removes
them afterwards, so it is safe and repeatable on a seeded database. Helpers live
in `src/test/integration.ts`. The default `pnpm test` excludes these.

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
Purchases, tickets and applications are pruned only when they belong to one of
the fixture accounts, never to an account created by hand.

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
  - `api` - Square webhook and event-image upload handlers
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
  `src/styles/marketing.css`; keep marketing-only styles inside that boundary.
- Use the `@/*` alias for imports from `src/*`.
- Server code logs through `log` from `@/lib/log`, which emits one structured
  JSON line per event. Name events as stable dot-paths (`payment.ticket_charge_failed`),
  identify records by id, and pass errors through `errorFields` so a message can
  never carry row data. An eslint rule keeps `console` out of `src/**/*.ts`;
  client components use `console` directly.
- `log.error` also reports to Sentry, which alerts on it, so log expected
  failures (card declines, validation) at `warn`. Sentry setup lives in
  `src/lib/sentry.ts`, and both runtimes scrub events before sending: the
  server drops exception messages, since a rethrown Supabase error can quote row
  data, and both drop query strings, request bodies, and cookies.

## Database Changes

Read `supabase/README.md` before changing the schema.

- Add a new focused migration; do not edit a migration that has been applied.
- Update the matching helper and `src/lib/supabase-helpers/tables.ts`.
- Try the migration locally first with `pnpm supabase:local`.
- Run `pnpm types:supabase` and commit the regenerated
  `src/lib/supabase/database.types.ts`. It reads the local database, so the
  types come from the migrations; CI regenerates them and fails on any
  difference.
- Merging deploys the migration: the Vercel production build
  (`scripts/vercel-build.sh`) runs `supabase db push` before `next build`, so
  the schema is in place before `/events/[slug]` is prerendered against it. A
  failed migration fails the build. The old code serves traffic while the build
  runs and a rollback does not undo a migration, so keep migrations
  backward-compatible with the code already in production. `db push` is
  forward-only; correct a bad migration with a new one.
- Keep the timestamp `supabase migration new` generates. CI
  (`scripts/check-migration-order.sh`) fails a PR whose new migration sorts
  before the newest one on `main`, because `db push` would refuse it.
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
- Sentry: `NEXT_PUBLIC_SENTRY_DSN` enables error reporting; leave it unset
  locally. Build-time `SENTRY_ORG`, `SENTRY_PROJECT`, and secret
  `SENTRY_AUTH_TOKEN` upload source maps on Vercel builds
- Check-in: server-only `CHECK_IN_TOKEN_SECRET` signs ticket QR codes
 (`src/lib/check-in-token.ts`); rotating it invalidates every issued ticket
- Discount codes: server-only `DISCOUNT_CODE_<BUSINESS>`, one per partner in
  `src/features/memberships/lib/discount-codes.ts`, kept out of the public repo.
  A code whose variable is unset is not shown
- Feature flags: `NEXT_PUBLIC_FEATURE_STUDENT_EVENTS` and
  `NEXT_PUBLIC_FEATURE_DARK_MODE` force a flag on or off; unset, both are on
  locally and on preview deploys and off in production (`src/lib/flags.ts`)
- Seed `prod` target: `SEED_PROD_SUPABASE_URL` and
  `SEED_PROD_SUPABASE_SECRET_KEY`
- Migrations: secret `SUPABASE_MIGRATIONS_DB_URL`, set in Vercel's Production
  environment only, is the session-mode pooler connection string the
  production build pushes migrations through. Never put it in `.env.local`

`SQUARE_ENV` is optional and defaults to the sandbox; set it to `production`
only for production credentials.

Never expose the Supabase secret keys, migrations database URL, Square access
token, webhook signature key, Resend API key, Sentry auth token, or check-in
token secret to client components.

## Quality

- Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test` after code changes.
- Also run `pnpm build` after route, dependency, configuration, schema, or
  shared-style changes.
- Run `pnpm test:integration` after changing a migration, a database function,
  or a Supabase helper. CI runs it in the `build` job, after the RLS suite.
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
design tokens instead of duplicating one-off styles.

Design tokens live in three layers: `src/styles/tokens/primitives.css` (raw
colours), `src/styles/tokens/semantic.css` (Light and Dark aliases, plus
density), and `src/app/globals.css` (maps them to Tailwind utilities and the
shadcn bridge). CSS variable names follow `docs/design-system.md` (the Figma
variable name with the slash turned into a hyphen). Dark mode is
`data-theme="dark"` on `<html>` (`src/lib/theme.ts`), and density is
`data-density="compact"`.

## Merging pull requests

`main` is protected by the `protect-main` ruleset, which requires one approving
review. GitHub doesn't let anyone approve their own pull request, so when an
agent works under the `johnny-581` account (which can bypass the ruleset) and
that user asks for a merge, merge with the bypass instead of waiting for an
approval:

```bash
gh pr ready <number>
gh pr merge <number> --admin --merge --delete-branch
```

- Merge only when the user asked for that pull request (or batch), it has been
  reviewed for correctness, and its CI checks are green.
- Use a merge commit (`--merge`), not squash or rebase.
- For stacked pull requests, retarget each dependent one to `main`
  (`gh pr edit <n> --base main`) before deleting the branch it's based on.
- Other accounts follow the normal review flow.

## Epics, responsiblity, and timeline

@docs/epics.md
