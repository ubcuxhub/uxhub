## Overview

This repo is a single Next.js application for UBC UX Hub. It currently includes:

- **Marketing site** - public homepage, public events listing, and an under-construction page
- **Auth flows** - login, sign-up, email confirmation, password reset, and auth error handling
- **Student portal** - auth-gated event browsing/application, membership purchase, purchase history, and profile management
- **Admin portal** - admin-gated event management, application review, check-in, and user management
- **Payments and integrations** - Square checkout, Square webhook fulfillment, Supabase Auth, and local event image uploads

The project uses the Next.js App Router under `src/app`, TypeScript, React 19, Next 16, Tailwind CSS v4, Supabase, and Square.

## Repo Structure

```text
uxhub/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root HTML, fonts, analytics, UserProvider
│   │   ├── globals.css                   # Global Tailwind/CSS
│   │   ├── 401/page.tsx                  # Unauthorized page
│   │   │
│   │   ├── (marketing)/                  # Public routes
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                  # Homepage
│   │   │   ├── events/
│   │   │   │   ├── page.tsx              # Public events listing
│   │   │   │   └── [slug]/page.tsx       # Public event detail
│   │   │   └── under-construction/page.tsx
│   │   │
│   │   ├── (auth)/auth/                  # Auth routes
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── sign-up/page.tsx
│   │   │   ├── sign-up-success/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── update-password/page.tsx
│   │   │   ├── error/page.tsx
│   │   │   ├── callback/route.ts         # OAuth callback
│   │   │   └── confirm/route.ts          # Supabase email confirmation callback
│   │   │
│   │   ├── (app)/                        # Shared authenticated boundary (requireAuth + UserProvider)
│   │   │   ├── layout.tsx                # requireAuth, UserProvider (no sidebar)
│   │   │   ├── (shell)/                  # Sidebar layout group (URLs unchanged)
│   │   │   │   ├── layout.tsx            # SidebarProvider + AppSidebar + SidebarInset
│   │   │   │   ├── portal/               # Auth-gated student browsing routes
│   │   │   │   │   ├── page.tsx          # Welcome / dashboard landing
│   │   │   │   │   ├── events/
│   │   │   │   │   │   ├── page.tsx      # Your registered events (ongoing/upcoming/attended)
│   │   │   │   │   │   └── [event]/page.tsx # Simple event detail by event slug
│   │   │   │   └── admin/                # Admin-gated routes
│   │   │   │       ├── layout.tsx        # requireAdmin guard only (sidebar comes from (shell))
│   │   │   │       ├── page.tsx          # Admin dashboard
│   │   │   │       ├── events/
│   │   │   │       │   ├── page.tsx      # Event list
│   │   │   │       │   ├── create-new/page.tsx   # Create event
│   │   │   │       │   └── [event]/
│   │   │   │       │       ├── page.tsx  # Edit/manage event by event ID
│   │   │   │       │       ├── check-in/page.tsx
│   │   │   │       │       └── review-applications/
│   │   │   │       │           ├── page.tsx
│   │   │   │       │           └── [registrationId]/page.tsx
│   │   │   │       └── users/page.tsx    # User directory and profile editing
│   │   │   └── (focused)/                # Chrome-free layout group, no sidebar (URLs unchanged)
│   │   │       ├── layout.tsx            # Full-height, sidebar-less container
│   │   │       └── portal/
│   │   │           ├── membership/
│   │   │           │   ├── page.tsx      # Membership tier list
│   │   │           │   ├── join/page.tsx # Join wizard (deep-linkable onboarding)
│   │   │           │   └── [membership]/
│   │   │           │       ├── page.tsx  # Legacy ID route; redirects to slug checkout
│   │   │           │       └── checkout/page.tsx # Membership checkout by membership slug
│   │   │           └── events/[event]/checkout/page.tsx # Event checkout by event slug
│   │   │
│   │   └── api/
│   │       ├── auth/complete-profile/route.ts # Authenticated profile creation
│   │       ├── upload-event-image/route.ts # Admin-only Supabase Storage cover upload
│   │       └── square/webhook/route.ts   # Square payment webhook
│   │
│   ├── components/
│   │   ├── ui/                           # Reusable UI primitives
│   │   └── shared/                       # App-wide shared components
│   │
│   ├── context/
│   │   └── UserContext.tsx               # Current user context and refresh helper
│   │
│   ├── features/                         # Domain modules
│   │   ├── admin/
│   │   │   ├── components/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── events/
│   │   │   ├── components/
│   │   │   ├── helpers/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── marketing/
│   │   │   ├── components/
│   │   │   ├── homepage-sections/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   ├── memberships/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── payments/
│   │   │   ├── actions.ts                # Checkout server action
│   │   │   ├── fulfillment.ts            # Checkout/webhook fulfillment logic
│   │   │   ├── schemas.ts
│   │   │   ├── types.ts
│   │   │   ├── components/
│   │   │   └── index.ts
│   │   └── settings/                     # Hash-driven settings dialog (#settings/<tab>)
│   │       ├── components/               # SettingsDialog + General/Profile/PurchaseHistory panels
│   │       └── index.ts                  # SettingsDialog, openSettings
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   └── guards.ts                 # requireAuth, requireAdmin
│   │   ├── square/
│   │   │   └── client.ts                 # Square SDK helpers
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser client
│   │   │   ├── server.ts                 # Server client, cookie-bound
│   │   │   ├── admin.ts                  # Service-role client, server-only
│   │   │   └── database.types.ts         # Generated Supabase types
│   │   ├── supabase-helpers/             # Data-access helper boundary
│   │   │   ├── admin-server.ts
│   │   │   ├── check-ins.ts
│   │   │   ├── event-applications.ts
│   │   │   ├── event-registrations.ts
│   │   │   ├── events.ts
│   │   │   ├── memberships.ts
│   │   │   ├── purchases.ts
│   │   │   ├── tables.ts
│   │   │   ├── types.ts
│   │   │   └── users.ts
│   │   ├── constants.ts
│   │   ├── slug.ts
│   │   └── utils.ts
│   │
│   ├── proxy.ts                          # Supabase session refresh for matched routes
│   └── types/
│       └── models.ts                     # Shared row/model aliases
│
├── public/
│   ├── favicon/
│   ├── icons/
│   └── people/
│
├── scripts/
│   └── seed/                             # Idempotent local seed script (`pnpm seed`)
│       ├── index.ts                      # CLI, guardrails, orchestration, summary
│       ├── lib/reconcile.ts              # upsertBySlug + reconcileChildren
│       └── data/                         # events.ts, membership-types.ts
│
├── supabase/
│   ├── migrations/                       # Versioned SQL migrations
│   └── README.md                         # Schema-change and helper runbook
│
├── docs/
│   ├── full_schema.sql
│   └── project-structure-and-routes.md
│
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── ...
```

## Architecture Notes

**Data access lives in `src/lib/supabase-helpers/`.** Pages, components, hooks, actions, and route handlers should call typed helpers instead of scattering raw `supabase.from("...")` calls. Helpers take an injected `DbClient` from `src/lib/supabase-helpers/types.ts`, so the same helper can run with the browser client, server client, service-role client, or tests. Raw table names, including realtime `postgres_changes` table names, should come from `TABLES` in `src/lib/supabase-helpers/tables.ts`.

**Service-role access is isolated.** RLS-bypassing operations use `src/lib/supabase/admin.ts` and the server-only helpers in `src/lib/supabase-helpers/admin-server.ts`. See [`supabase/README.md`](../supabase/README.md) for the schema-change runbook and table-to-helper mapping.

**Use server actions for first-party mutations when possible.** The checkout flow currently uses `src/features/payments/actions.ts`, which delegates to `src/features/payments/fulfillment.ts`. Route handlers are still used where a normal form/action boundary is not enough: Supabase email confirmation, Square webhooks, Auth-to-`user_info` linking, and event image upload.

**Layouts handle access control.** `src/proxy.ts` refreshes Supabase sessions for `/admin`, `/portal`, and `/api` requests. It does not decide authorization. The shared `src/app/(app)/layout.tsx` calls `requireAuth()` and wraps everything in `UserProvider` (no sidebar of its own). It then splits into two layout-only route groups that leave every URL unchanged: `src/app/(app)/(shell)/layout.tsx` renders the unified `AppSidebar` (`src/components/shared/AppSidebar.tsx`) inside a `SidebarProvider` around the student browsing routes and admin, while `src/app/(app)/(focused)/layout.tsx` is a full-height, sidebar-less container for the membership list, join wizard, and checkout pages. The nested `src/app/(app)/(shell)/admin/layout.tsx` adds `requireAdmin()` as a guard only. Because the shell routes share the `(shell)` parent layout, the sidebar persists when navigating between student and admin pages; admin tabs render only when `user.role_access === "admin"`. The `(focused)` group is how a URL-child (e.g. `/portal/events/[event]/checkout`) opts out of the sidebar its URL-parent (`/portal/events/[event]`) still shows — route groups decouple layout inheritance from the URL hierarchy.

**Local sample data comes from `pnpm seed`, not from migrations.** No migration inserts rows, so
`supabase db reset` leaves an empty database and `/portal/membership`, `/admin/events`, and the
public `/events` page render nothing. `scripts/seed/` fills it with four membership tiers and two
seasons of events (2025-26 past, 2026-27 upcoming) plus their check-in sessions and application
questions. It is safe to re-run: parents are upserted on their `slug` unique constraint, children
are reconciled by natural key, and deletes require `--prune` because `event_registrations`,
`check_ins`, and `event_application_responses` cascade off those tables. The script refuses to
run against a non-local Supabase unless passed `--allow-remote`, since it authenticates with the
RLS-bypassing service-role key. Data lives in `scripts/seed/data/*.ts`, typed against
`src/lib/supabase/database.types.ts` so column and enum typos fail `pnpm build`.

**Settings live in a hash-driven dialog.** `AppSidebar`'s footer "Profile & settings" button opens `SettingsDialog` (`src/features/settings`) instead of navigating. The dialog is a shadcn `Dialog` containing an in-dialog shadcn `Sidebar` with General / Profile / Purchase history tabs, and is controlled entirely by the URL hash `#settings/<tab>` (so `/portal#settings/profile` deep-links straight to the Profile tab). Call `openSettings(tab)` to open it from anywhere. The Profile tab edits `user_info` via `updateUserInfoById` + `refreshUser`. The Purchase history tab lists the user's purchases via `fetchPurchasesForUser` — there is no standalone `/portal/purchases` route; the checkout success flow redirects to `/portal#settings/purchases`.

## URL Conventions

### Public - `(marketing)`

```text
/
/events
/events/[slug]
/under-construction
```

`/events/[slug]` is the full public event-detail page that homepage and calendar cards link to. There are currently no separate public `/about`, `/team`, `/contact`, or `/membership` routes.

### Auth - `(auth)`

```text
/auth/login
/auth/sign-up
/auth/sign-up-success
/auth/forgot-password
/auth/update-password
/auth/error
/auth/callback
/auth/confirm
```

### Student Portal - `(app)/portal`

```text
/portal                                    # (shell) — sidebar
/portal/events                             # (shell) — sidebar
/portal/events/[event]                     # (shell) — sidebar
/portal/events/[event]/checkout            # (focused) — no sidebar
/portal/membership                         # (focused) — no sidebar
/portal/membership/join                    # (focused) — no sidebar
/portal/membership/[membership]            # (focused) — no sidebar
/portal/membership/[membership]/checkout   # (focused) — no sidebar
```

Notes:

- URLs are unchanged from before the `(shell)`/`(focused)` split; the group only decides whether the sidebar renders.
- `/portal` is a simple welcome landing (greeting + a "become a member" banner for non-members).
- `/portal/events` is the personalized registered-events view (ongoing/upcoming/attended) plus a link to the public `/events` page. Event cards link to the portal `/portal/events/[slug]` detail page.
- `[event]` is treated as an event slug in student-facing routes. `/portal/events/[event]` is a simple portal event-detail page (name, date/time, location, and a button linking to the public `/events/[slug]` page); `/portal/events/[event]/checkout` handles checkout (sidebar-less).
- `/portal/membership/join` is the deep-linkable membership onboarding wizard (`MembershipWizard`) — it collects user type / identity, then redirects to `/portal/membership`. The profile page's "Join now" button links here.
- `/portal/membership/[membership]` is a legacy ID route that looks up the membership type by ID and redirects to `/portal/membership/[slug]/checkout`.
- There is no checkout confirmation route at the moment.

### Admin - `(app)/admin`

```text
/admin
/admin/events
/admin/events/create-new
/admin/events/[event]
/admin/events/[event]/check-in
/admin/events/[event]/review-applications
/admin/events/[event]/review-applications/[registrationId]
/admin/users
```

Notes:

- `[event]` is treated as an event ID in admin routes.
- Admin event editing happens at `/admin/events/[event]`; there is no separate `/edit` child route.
- There are currently no admin purchase-list, purchase-detail, or individual user-detail pages.

### API

```text
/api/auth/complete-profile
/api/upload-event-image
/api/square/webhook
```
