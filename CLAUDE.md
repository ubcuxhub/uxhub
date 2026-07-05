# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

If you make a significant edit, always make sure this file is up to date. Also make sure @docs/structure-and-routes.md is up to date.

## Project Overview

UX Hub is a single Next.js application using the App Router under `src/app`. It contains:

- Public marketing routes at `/`, `/events`, and `/under-construction`
- Student portal under `/portal/*`
- Admin portal under `/admin/*`
- Auth pages under `/auth/*`
- API routes for callbacks, integrations, user linking, and uploads under `/api/*`

The app uses Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase, Square, and the Babel React Compiler.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm start
```

## Architecture

- `src/app` - Next.js App Router routes
  - `(marketing)` - public marketing routes
  - `(app)` - shared authenticated boundary (`requireAuth` + `UserProvider`), split into two layout groups
    - `(app)/(shell)` - sidebar shell: student portal browsing (`portal/*`) and admin (`admin/*`)
    - `(app)/(focused)` - chrome-free flows (no sidebar): membership list, join wizard, and checkout pages
  - `(auth)/auth` - auth routes
  - `api` - server route handlers and callbacks
- `src/features` - domain logic and feature UI
  - `marketing` - ported homepage components, sections, data, and types
  - `events` - event browsing, details, applications, and event UI
  - `memberships` - membership checkout and related types
  - `auth` - auth components and user types
  - `admin` - admin UI and types
  - `payments` - Square checkout actions, schemas, fulfillment, and checkout UI
- `src/components/ui` - shared shadcn-style primitives
- `src/components/shared` - shared app composites
- `src/context` - current user context
- `src/lib` - Supabase clients, typed helper boundary, auth guards, Square client, constants, and utilities
- `public` - public marketing and portal assets
- `supabase` - migrations and Supabase project files

## Important Patterns

- `src/proxy.ts` refreshes Supabase sessions for `/portal/*`, `/admin/*`, and `/api/*`.
- Route group layouts and server code handle authorization with `requireAuth()` and `requireAdmin()` from `src/lib/auth/guards.ts`. The shared `(app)/layout.tsx` calls `requireAuth()` and wraps children in `UserProvider` (no sidebar). It splits into two layout-only route groups that keep every URL unchanged: `(app)/(shell)/layout.tsx` renders the unified `AppSidebar` (`src/components/shared/AppSidebar.tsx`) around portal-browsing and admin routes, while `(app)/(focused)/layout.tsx` is a chrome-free, sidebar-less container for the membership list, join wizard, and checkout flows. The nested `(app)/(shell)/admin/layout.tsx` adds `requireAdmin()` as a guard only. The sidebar shows admin tabs when `user.role_access === "admin"`.
- Data access should go through typed helpers in `src/lib/supabase-helpers/`. Avoid scattering raw `supabase.from("...")` calls through pages and components.
- Service-role access belongs in `src/lib/supabase/admin.ts` and `src/lib/supabase-helpers/admin-server.ts`.
- Pages rendered inside the `(app)/(shell)` sidebar group wrap their content in `PageContainer` (`src/components/shared/PageContainer.tsx`) for a consistent max-width and edge padding. Sidebar-less routes in `(app)/(focused)` also use `PageContainer` and pass `backHref`/`backLabel` to render a top-left back button to their parent route. `/admin/users` is intentionally exempt (full-height split-pane).
- Marketing styles are scoped through the `marketing-home` wrapper in `src/app/globals.css` so homepage fonts/colors do not leak into portal/admin UI.
- Use the `@/*` path alias for imports from `src/*`.
- Prefer server actions for app-owned mutations. Keep `/api` for callbacks/integrations and route-handler-specific needs such as Supabase email confirmation, Square webhooks, auth user linking, and event image upload.

## Current Routes

```text
/
/events
/events/[slug]
/under-construction

/auth/login
/auth/sign-up
/auth/sign-up-success
/auth/forgot-password
/auth/update-password
/auth/error
/auth/confirm

/portal
/portal/events
/portal/events/[event]
/portal/events/[event]/checkout
/portal/membership
/portal/membership/join
/portal/membership/[membership]
/portal/membership/[membership]/checkout
/portal/purchases
/portal/purchases/[purchaseId]
/portal/profile

/admin
/admin/events
/admin/events/create-new
/admin/events/[event]
/admin/events/[event]/check-in
/admin/events/[event]/review-applications
/admin/events/[event]/review-applications/[registrationId]
/admin/users

/api/link-auth-user
/api/upload-event-image
/api/square/webhook
```

Student event routes use event slugs. Admin event routes currently use event IDs.

## Environment

Local env values live in `.env.local` and are git-ignored. Required variables include Supabase public keys and Square configuration.

## Quality

Run `pnpm lint` and `pnpm build` after route, dependency, config, or shared styling changes.

## UI

Use components in src/components whenever possible. Use shadcn components whenever possible.
