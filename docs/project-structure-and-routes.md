## Overview

A single Next.js application covering UBC UX Hub's full digital surface:

- **Marketing site** — public homepage, about, team, contact, events listing, membership info
- **Public event pages** — shareable, SEO-indexed event detail pages
- **Student portal** — auth-gated area for purchasing event tickets and memberships, viewing tickets, and managing profile
- **Admin portal** — role-gated area for managing events, users, and memberships

## Repo Structure

```python
uxhub/
├── app/
│   ├── (marketing)/                       # Public site, no auth
│   │   ├── page.tsx                       # Homepage
│   │   ├── about/page.tsx
│   │   ├── team/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── events/
│   │   │   ├── page.tsx                   # Public event list
│   │   │   └── [slug]/page.tsx            # Public event detail
│   │   ├── membership/page.tsx            # Marketing page about memberships
│   │   └── layout.tsx
│   │
│   ├── (student)/                         # Auth-gated
│   │   └── portal/
│   │       ├── page.tsx                   # Dashboard
│   │       ├── events/
│   │       │   ├── page.tsx               # My events + browse
│   │       │   └── [slug]/
│   │       │       ├── checkout/page.tsx
│   │       │       └── confirmation/page.tsx   # reads ?order=
│   │       ├── membership/                # singular — user has one
│   │       │   ├── page.tsx               # Status + plans
│   │       │   └── [plan]/
│   │       │       ├── checkout/page.tsx
│   │       │       └── confirmation/page.tsx   # reads ?order=
│   │       ├── purchases/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx          # Receipt (events or memberships)
│   │       ├── profile/page.tsx
│   │       └── layout.tsx                 # requireAuth
│   │
│   ├── (admin)/                           # Role-gated
│   │   └── admin/
│   │       ├── page.tsx                   # Dashboard
│   │       ├── events/
│   │       │   ├── page.tsx               # List
│   │       │   ├── new/page.tsx
│   │       │   └── [slug]/
│   │       │       ├── page.tsx           # Detail
│   │       │       ├── edit/page.tsx
│   │       │       └── attendees/
│   │       │           └── [userId]/page.tsx
│   │       ├── users/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── purchases/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       └── layout.tsx                 # requireAdmin
│   │
│   ├── (auth)/
│   │   └── auth/
│   │       ├── login/page.tsx
│   │       ├── sign-up/page.tsx
│   │       ├── sign-up-success/page.tsx
│   │       ├── forgot-password/page.tsx
│   │       ├── update-password/page.tsx
│   │       ├── error/page.tsx
│   │       └── confirm/route.ts           # Supabase email confirmation
│   │
│   └── api/                               # Webhooks & third-party callbacks only
│       └── square/webhook/route.ts
│
├── features/                              # Domain logic, organized by concept
│   ├── events/
│   │   ├── queries.ts                     # Read functions (server)
│   │   ├── actions.ts                     # Server actions (mutations)
│   │   ├── schemas.ts                     # Zod validation
│   │   ├── types.ts
│   │   └── components/                    # Event-specific UI
│   ├── memberships/
│   ├── users/
│   └── payments/                          # Square client + webhook handlers
│
├── components/
│   ├── ui/                                # Primitives (shadcn-style)
│   └── shared/                            # App-wide composites (nav, footer)
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                      # Browser client
│   │   ├── server.ts                      # Server client (cookie-bound)
│   │   ├── admin.ts                       # Service role — server-only
│   │   ├── proxy.ts                       # Session refresh helper
│   │   └── database.types.ts              # Generated via `supabase gen types`
│   ├── supabase-helpers/                  # Single data-access boundary
│   │   ├── types.ts                       # Shared DbClient type
│   │   ├── tables.ts                      # TABLES name map (also for realtime)
│   │   ├── events.ts                      # Per-domain query/mutation helpers
│   │   ├── event-registrations.ts
│   │   ├── event-applications.ts
│   │   ├── check-ins.ts
│   │   ├── users.ts
│   │   ├── memberships.ts
│   │   └── admin-server.ts                # Service-role helpers — server-only
│   ├── square/
│   │   └── client.ts                      # Square SDK client — server-only
│   ├── auth/
│   │   └── guards.ts                      # requireAuth, requireAdmin
│   └── utils.ts
│
├── proxy.ts                               # Refreshes Supabase session
│
├── supabase/
│   ├── migrations/                        # SQL migrations (version-controlled)
│   └── seed.sql
│
└── ...
```

**All table access goes through `src/lib/supabase-helpers/`.** This is the single data-access boundary. Pages, hooks, components, server actions, and route handlers call typed domain helpers (e.g. `fetchEventById`, `updateEventRegistration`) instead of writing `supabase.from("...")` inline. Each helper takes an injected `DbClient` (`src/lib/supabase-helpers/types.ts`), so the same function works on the browser client, the server client, and in tests. Raw table names — including realtime `postgres_changes` table strings — come from the `TABLES` map (`src/lib/supabase-helpers/tables.ts`). Service-role (RLS-bypassing) access lives in `admin-server.ts` and uses the shared server-only client at `src/lib/supabase/admin.ts`. See [`supabase/README.md`](../supabase/README.md) for the schema-change runbook and a table → helper map.

**Server actions for your own mutations; `/api` only for third parties.** Square webhooks, OAuth callbacks, anything an external system calls — those need `/api/.../route.ts`. Your own forms (purchase a ticket, create an event) should use server actions colocated in `features/<domain>/actions.ts`, delegating to the `supabase-helpers` layer for the actual queries. Less boilerplate, type-safe end to end.

**Proxy does session refresh, not gatekeeping.** Next's `proxy.ts` should call Supabase's session-refresh helper on matched requests (otherwise tokens expire mid-session). Put the actual "is this user allowed here" checks in route group layouts, where you have full server context and can redirect cleanly.

## URL Conventions

### Public — `(marketing)`

```
ubcuxhub.ca/
ubcuxhub.ca/about
ubcuxhub.ca/team
ubcuxhub.ca/contact
ubcuxhub.ca/events
ubcuxhub.ca/events/portfolio-night-2026
ubcuxhub.ca/membership
```

### Auth — `(auth)`

```
ubcuxhub.ca/auth/login
ubcuxhub.ca/auth/sign-up
ubcuxhub.ca/auth/sign-up-success
ubcuxhub.ca/auth/forgot-password
ubcuxhub.ca/auth/update-password
ubcuxhub.ca/auth/error
ubcuxhub.ca/auth/confirm
```

### Student portal — `(student)`

```
ubcuxhub.ca/portal
ubcuxhub.ca/portal/events
ubcuxhub.ca/portal/events/thinkbox-office-tour/checkout
ubcuxhub.ca/portal/events/thinkbox-office-tour/confirmation?order=ord_abc123
ubcuxhub.ca/portal/membership
ubcuxhub.ca/portal/membership/[plan]/checkout
ubcuxhub.ca/portal/membership/[plan]/confirmation?order=ord_abc456 # plan = [innovator, explorer, faculty, non-ubc]
ubcuxhub.ca/portal/purchases
ubcuxhub.ca/portal/purchases/ord_abc123
ubcuxhub.ca/portal/profile
```

### Admin — `(admin)`

```
ubcuxhub.ca/admin/events
ubcuxhub.ca/admin/events/new
ubcuxhub.ca/admin/events/uxathon-2026
ubcuxhub.ca/admin/events/uxathon-2026/edit
ubcuxhub.ca/admin/events/uxathon-2026/attendees/usr_abc123
ubcuxhub.ca/admin/users
ubcuxhub.ca/admin/users/usr_xyz789
ubcuxhub.ca/admin/purchases
ubcuxhub.ca/admin/purchases/ord_abc456
```

### API — webhooks only

```
ubcuxhub.ca/api/square/webhook
```
