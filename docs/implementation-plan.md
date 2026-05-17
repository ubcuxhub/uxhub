## Overview

A single Next.js application covering UBC UX Hub's full digital surface:

- **Marketing site** — public homepage, about, team, contact, events listing, membership info
- **Public event pages** — shareable, SEO-indexed event detail pages
- **Student portal** — auth-gated area for purchasing event tickets and memberships, viewing tickets, and managing profile
- **Admin portal** — role-gated area for managing events, users, and memberships

## Repo Structure

```python
ubcux/
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
│   │   └── proxy.ts                       # Session refresh helper
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
│   ├── seed.sql
│   └── types.ts                           # Generated via `supabase gen types`
│
└── ...
```

**Server actions for your own mutations; `/api` only for third parties.** Square webhooks, OAuth callbacks, anything an external system calls — those need `/api/.../route.ts`. Your own forms (purchase a ticket, create an event) should use server actions colocated in `features/<domain>/actions.ts`. Less boilerplate, type-safe end to end.

**Proxy does session refresh, not gatekeeping.** Next's `proxy.ts` should call Supabase's session-refresh helper on matched requests (otherwise tokens expire mid-session). Put the actual "is this user allowed here" checks in route group layouts, where you have full server context and can redirect cleanly.

## URL Conventions

### Public — `(marketing)`

```
ubcuxhub.com/
ubcuxhub.com/about
ubcuxhub.com/team
ubcuxhub.com/contact
ubcuxhub.com/events
ubcuxhub.com/events/portfolio-night-2026
ubcuxhub.com/membership
```

### Auth — `(auth)`

```
ubcuxhub.com/auth/login
ubcuxhub.com/auth/sign-up
ubcuxhub.com/auth/sign-up-success
ubcuxhub.com/auth/forgot-password
ubcuxhub.com/auth/update-password
ubcuxhub.com/auth/error
ubcuxhub.com/auth/confirm
```

### Student portal — `(student)`

```
ubcuxhub.com/portal
ubcuxhub.com/portal/events
ubcuxhub.com/portal/events/thinkbox-office-tour/checkout
ubcuxhub.com/portal/events/thinkbox-office-tour/confirmation?order=ord_abc123
ubcuxhub.com/portal/membership
ubcuxhub.com/portal/membership/[plan]/checkout
ubcuxhub.com/portal/membership/[plan]/confirmation?order=ord_abc456 # plan = [innovator, explorer, faculty, non-ubc]
ubcuxhub.com/portal/purchases
ubcuxhub.com/portal/purchases/ord_abc123
ubcuxhub.com/portal/profile
```

### Admin — `(admin)`

```
ubcuxhub.com/admin/events
ubcuxhub.com/admin/events/new
ubcuxhub.com/admin/events/uxathon-2026
ubcuxhub.com/admin/events/uxathon-2026/edit
ubcuxhub.com/admin/events/uxathon-2026/attendees/usr_abc123
ubcuxhub.com/admin/users
ubcuxhub.com/admin/users/usr_xyz789
ubcuxhub.com/admin/purchases
ubcuxhub.com/admin/purchases/ord_abc456
```

### API — webhooks only

```
ubcuxhub.com/api/square/webhook
```
