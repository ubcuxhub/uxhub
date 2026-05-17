# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

UX Hub is a single Next.js application at the repository root. It contains:

- Public marketing homepage at `/`
- Student portal under `/portal/*`
- Admin portal under `/admin/*`
- Auth pages under `/auth/*`
- API routes under `/api/*`

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
  - `(student)/portal` - authenticated student portal routes
  - `admin` - admin routes
  - `auth` - auth routes
  - `api` - server API routes and callbacks
- `src/features` - domain logic and feature UI
  - `marketing` - ported homepage components, sections, data, and types
  - `events` - event browsing, details, applications, and event UI
  - `memberships` - membership checkout and related types
  - `auth` - auth components and user types
  - `admin` - admin UI, queries, and types
- `src/components/ui` - shared shadcn-style primitives
- `src/components/shared` - shared app composites
- `src/lib` - Supabase clients, queries, constants, and utilities
- `public` - public marketing and portal assets
- `supabase` - migrations and Supabase project files

## Important Patterns

- Middleware refreshes Supabase sessions for `/portal/*`, `/admin/*`, and `/api/*`.
- Route/page components handle authorization through the existing `ProtectedRoute` pattern.
- Marketing styles are scoped through the `marketing-home` wrapper in `src/app/globals.css` so homepage fonts/colors do not leak into portal/admin UI.
- Use the `@/*` path alias for imports from `src/*`.
- Keep `/api` for callback/integration endpoints; prefer colocated feature functions for app-owned behavior.

## Environment

Local env values live in `.env.local` and are git-ignored. Required variables include Supabase public keys and Square configuration.

## Quality

Run `pnpm lint` and `pnpm build` after route, dependency, config, or shared styling changes.
