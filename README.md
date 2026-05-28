# UX Hub

Single Next.js app for UBC UX Hub's public marketing site, student portal, admin tools, auth flows, and API callbacks.

## Routes

- `/` - public homepage
- `/under-construction` - temporary marketing placeholder route
- `/portal/*` - authenticated student portal
- `/admin/*` - admin portal
- `/auth/*` - login, signup, password reset, and auth callback pages
- `/api/*` - server callbacks and integrations

## Getting Started

**Prerequisites:** Node.js 18+ and pnpm 10.6.2+

```bash
pnpm install
pnpm dev
```

Duplicate the `.env.example`, rename it to `.env.local`, and populate the values (which can be found here: https://www.notion.so/Env-36a2f9f09f188041a555c36b7a1b2bd1?v=35e2f9f09f18818e8a4a000c8317ade4&source=copy_link)

The app runs at `http://localhost:3000` by default.

## Commands

```bash
pnpm dev      # Start the Next.js dev server
pnpm build    # Build for production
pnpm start    # Start the production server
pnpm lint     # Run ESLint
pnpm types:supabase # Regenerate Supabase TypeScript types
```

## Supabase Migrations

```bash
supabase login
supabase link
supabase db pull
```

Typical workflow:

```bash
supabase migration new add_user_profiles
supabase db push
```

Guidelines:

- Create new migrations instead of editing applied migrations.
- Keep migrations small and focused.
- Use descriptive migration names.
- Avoid mixing `db pull` and `db push` in the same workflow.
- **Regenerate types:** after any schema change, run `pnpm types:supabase`, then `pnpm exec tsc --noEmit`, and commit the updated `src/lib/supabase/database.types.ts`.
