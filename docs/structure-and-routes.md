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
│   │   │   ├── events/page.tsx           # Public events listing
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
│   │   │   └── confirm/route.ts          # Supabase email confirmation callback
│   │   │
│   │   ├── (student)/portal/             # Auth-gated routes
│   │   │   ├── layout.tsx                # requireAuth
│   │   │   ├── events/
│   │   │   │   ├── page.tsx              # Browse portal events
│   │   │   │   └── [event]/
│   │   │   │       ├── page.tsx          # Event detail/application by event slug
│   │   │   │       └── checkout/page.tsx # Event checkout by event slug
│   │   │   ├── membership/
│   │   │   │   ├── page.tsx              # Membership tier list
│   │   │   │   └── [membership]/
│   │   │   │       ├── page.tsx          # Legacy ID route; redirects to slug checkout
│   │   │   │       └── checkout/page.tsx # Membership checkout by membership slug
│   │   │   ├── purchases/
│   │   │   │   ├── page.tsx              # User purchase history
│   │   │   │   └── [purchaseId]/page.tsx # User purchase detail/receipt
│   │   │   └── profile/page.tsx
│   │   │
│   │   ├── (admin)/admin/                # Admin-gated routes
│   │   │   ├── layout.tsx                # requireAdmin, AdminSidebar
│   │   │   ├── page.tsx                  # Admin dashboard
│   │   │   ├── events/
│   │   │   │   ├── page.tsx              # Event list
│   │   │   │   ├── create-new/page.tsx   # Create event
│   │   │   │   └── [event]/
│   │   │   │       ├── page.tsx          # Edit/manage event by event ID
│   │   │   │       ├── check-in/page.tsx
│   │   │   │       └── review-applications/
│   │   │   │           ├── page.tsx
│   │   │   │           └── [registrationId]/page.tsx
│   │   │   └── users/page.tsx            # User directory and profile editing
│   │   │
│   │   └── api/
│   │       ├── link-auth-user/route.ts   # Links Supabase Auth user to user_info
│   │       ├── upload-event-image/route.ts # Local public/event_images upload
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
│   │   └── payments/
│   │       ├── actions.ts                # Checkout server action
│   │       ├── fulfillment.ts            # Checkout/webhook fulfillment logic
│   │       ├── schemas.ts
│   │       ├── types.ts
│   │       ├── components/
│   │       └── index.ts
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

**Layouts handle access control.** `src/proxy.ts` refreshes Supabase sessions for `/admin`, `/portal`, and `/api` requests. It does not decide authorization. `src/app/(student)/portal/layout.tsx` calls `requireAuth()`, and `src/app/(admin)/admin/layout.tsx` calls `requireAdmin()`.

## URL Conventions

### Public - `(marketing)`

```text
/
/events
/under-construction
```

There are currently no separate public `/about`, `/team`, `/contact`, `/membership`, or public event-detail routes.

### Auth - `(auth)`

```text
/auth/login
/auth/sign-up
/auth/sign-up-success
/auth/forgot-password
/auth/update-password
/auth/error
/auth/confirm
```

### Student Portal - `(student)`

```text
/portal
/portal/events/[event]
/portal/events/[event]/checkout
/portal/membership
/portal/membership/[membership]
/portal/membership/[membership]/checkout
/portal/purchases
/portal/purchases/[purchaseId]
/portal/profile
```

Notes:

- `/portal` is the personalized student dashboard: registered events (purchased, upcoming), past events, a link to the public `/events` page, and a "become a member" banner for non-members.
- `[event]` is treated as an event slug in student-facing routes.
- `/portal/membership/[membership]` is a legacy ID route that looks up the membership type by ID and redirects to `/portal/membership/[slug]/checkout`.
- There is no checkout confirmation route at the moment.

### Admin - `(admin)`

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
/api/link-auth-user
/api/upload-event-image
/api/square/webhook
```
