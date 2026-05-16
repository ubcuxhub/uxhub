# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UX Hub is a **pnpm workspace monorepo** with two Next.js applications and a shared UI package:

- **homepage** (`apps/homepage`) — Public-facing marketing site (ubcuxhub.ca)
  - Next.js 16.2.2 with Turbopack
  - React 19.2.4, TypeScript 5
  - Tailwind CSS 4, Framer Motion, GSAP animations
  - Client-side components only ("use client")
  - Hosts marketing content: hero section, about/team info, events listing, mailing list signup

- **portal** (`apps/portal`) — Authentication-gated student and admin portal
  - Next.js 16.0.10, React 19.2.0, TypeScript 5
  - Supabase (PostgreSQL) for auth and data
  - Square SDK for payment processing
  - Babel React Compiler enabled for optimization
  - Multiple feature domains: auth, memberships, events, admin
  - Middleware-based session refresh (not gatekeeping)

- **@uxhub/ui** (`packages/ui`) — Shared component library (currently minimal)

Both apps use Tailwind CSS 4 with PostCSS, ESLint with Next.js rules, and strict TypeScript.

## Getting Started & Commands

**Prerequisites:** Node.js 18+, pnpm 10.6.2+

```bash
# Install dependencies (run from root)
pnpm install

# Run development servers (parallel)
pnpm dev              # Starts both homepage (3000) and portal (3001)
pnpm dev:homepage     # Homepage only on http://localhost:3000
pnpm dev:portal       # Portal only on http://localhost:3001

# Build all apps
pnpm build

# Lint with ESLint
pnpm -r lint          # Lint all packages
```

Each app can also be developed independently:
```bash
cd apps/homepage
pnpm dev              # Just this app
pnpm lint             # Lint rules configured in eslint.config.mjs
```

## Architecture & Code Patterns

### Portal (Core Business Logic)

The portal is where most complexity lives. It uses:

**Authentication & User State**
- Supabase Auth (email/password + OAuth via middleware)
- `src/middleware.ts` refreshes Supabase session on every request to prevent token expiry
- `src/context/UserContext.tsx` — React context providing `useUser()` hook with:
  - `user` — Current user record from `user_info` table
  - `loading` — Initial load state
  - `refreshUser()` — Manual refresh method
- Auth redirects: home → `/events` (logged in) or `/auth/login` (not logged in)

**Feature Organization**
- `src/features/` — Domain-driven structure: `auth/`, `events/`, `memberships/`, `admin/`
- Each feature contains:
  - `components/` — Feature-specific UI components
  - `index.ts` — Exports (types, components)
  - Uses server actions for mutations (colocated, not in `/api`)

**Database Access**
- Supabase client factories:
  - `src/lib/supabase/client.ts` — Browser client (public anon key)
  - `src/lib/supabase/server.ts` — Server client (async, reads cookies)
- `src/lib/queries/` — Data fetching functions (e.g., `user.ts` with `ensureUserInfo()`)

**Protected Routes**
- Use `src/middleware.ts` matcher config to refresh session for guarded paths (`/admin/*`, `/events/*`, `/profile/*`, `/memberships/*`)
- Route group layouts should handle actual authorization (not middleware) — check `UserProvider` context and redirect if unauthorized
- Currently implements: auth check on portal root, admin-gated `/admin` page

**Admin Features**
- Admin components in `src/features/admin/components/` (CheckInTable, ApplicantInfo, UserDirectory, etc.)
- Admin page at `/admin` uses `UserContext` to check for admin role

**Styling**
- Tailwind CSS 4 with PostCSS
- Shared UI primitives in `src/components/ui/` (Card, Button, Label, Badge, Separator, Checkbox from Radix UI)
- Shared layouts in `src/components/shared/`

### Homepage (Marketing)

- Minimal setup: static sections composed in `src/app/page.tsx`
- `src/homepage-sections/` — Page sections (HeroSection, TeamSection, EventsSection, etc.)
- `src/components/` — Helper components (EventCard, DotGrid, etc.)
- `src/lib/` — Data sources (team.ts, sponsors.ts, events.ts)
- No database queries; data is hardcoded or fetched from public APIs
- Uses Framer Motion and GSAP for animations
- Interactive elements: DND Kit for drag-and-drop, React Resizable for resizing
- Vercel Analytics integrated

### TypeScript & Import Paths

Both apps use path alias `@/*` → `./src/*` in `tsconfig.json`. Use this for cleaner imports:
```tsx
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
```

### Next.js Configuration

**Homepage** (`next.config.ts`):
- Transpiles `@uxhub/ui` for workspace consumption
- No special features

**Portal** (`next.config.ts`):
- Transpiles `@uxhub/ui`
- **Babel React Compiler enabled** (`reactCompiler: true`) — auto-optimization, be aware when debugging render issues

## Key Non-Obvious Patterns

1. **Session Refresh in Middleware, Not Gatekeeping**
   - `src/middleware.ts` only refreshes Supabase session tokens on protected paths
   - Real authorization checks happen in route layouts (check `UserContext`, redirect if needed)
   - This keeps middleware simple and avoids double checks

2. **UserInfo Table Auto-Creation**
   - `src/lib/queries/user.ts::ensureUserInfo()` — Creates `user_info` record on first login if missing
   - Called after auth success; sets default `membership_type: "NonUbc"` and `role_access: "basic"`
   - Handles "no rows found" (PGRST116) error gracefully

3. **Silent User Refresh**
   - `UserContext` tracks `hasUser` ref to avoid loading flicker on token refresh
   - `TOKEN_REFRESHED` events are ignored if user is already loaded (skips reload)
   - `loadUser(silent = true)` for background refreshes

4. **Portal uses Next.js 16 + Turbopack (Homepage), Portal uses 16.0.10**
   - Homepage has `--turbopack` in dev script (faster builds)
   - Portal doesn't; uses standard webpack bundler
   - Both support React 19 Server Components but apps use "use client" extensively

## Environment Variables

**Portal** (`apps/portal/.env.local`) — Required:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key (published)
- Square SDK keys likely needed (configured via @square/web-sdk)

## Git Workflow

Recent changes show monorepo maturation (pnpm workspace setup, app reorganization). Key commands:
- `git status` — Check uncommitted changes
- `git log --oneline` — View recent commits

## ESLint Configuration

**Portal** (`apps/portal/eslint.config.mjs`):
- Uses FlatCompat for Next.js core-web-vitals and TypeScript rules
- Ignores `.next/`, `out/`, `build/`, `next-env.d.ts`

**Homepage** (`apps/homepage/eslint.config.mjs`):
- Similar Next.js rules via FlatCompat

Run `pnpm lint` per app to check.

## Documentation

- `/docs/implementation-plan.md` — Outdated design doc showing original single-app vision (pre-monorepo refactor). Current state is two separate apps in `apps/`. Use for historical context only.

## Testing & Quality

No test framework currently configured (Jest/Vitest not in package.json). Add tests as needed with:
```bash
pnpm add -D vitest @testing-library/react  # or jest
```

