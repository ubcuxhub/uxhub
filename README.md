# UX Hub

Single Next.js app for UBC UX Hub's public marketing site, student portal, admin tools, auth flows, and API callbacks.

## Routes

- `/` - public homepage
- `/events/*` - public event pages
- `/portal/*` - authenticated student portal
- `/admin/*` - admin portal
- `/auth/*` - login, signup, password reset, and auth callback pages
- `/api/*` - server callbacks and integrations

## Getting Started

**Prerequisites:** Node.js 22.18+ (the scripts run TypeScript directly) and pnpm 10.6.2+

```bash
pnpm install
pnpm dev
```

Duplicate `.env.local.example`, rename it to `.env.local`, and populate the values (which can be found here: https://www.notion.so/Env-36a2f9f09f188041a555c36b7a1b2bd1?v=35e2f9f09f18818e8a4a000c8317ade4&source=copy_link)

The app runs at `http://localhost:3000` by default.

To run against a local Supabase instead of the hosted project, follow
[`supabase/README.md`](supabase/README.md#rebuild-the-local-database).

### Local Webhook Setup with ngrok (mandatory for payment-related functionality)

To receive Square webhook notifications during local development, you need to expose your local server:

1. Start ngrok to tunnel to port 3000 (install if haven't already):
   ```bash
   ngrok http 3000
   ```
2. Copy the forwarding URL (e.g., `https://your-subdomain.ngrok-free.dev`).
3. Go to the Square Developer Console and, under **Webhooks/Subscriptions**, register a new webhook subscription pointing to your ngrok URL: `https://your-subdomain.ngrok-free.dev/api/square/webhook`.
4. Update your `.env.local` file with the signature key and notification URL:
   - `SQUARE_WEBHOOK_SIGNATURE_KEY`: Your webhook signature key from the Square Developer Console.
   - `SQUARE_WEBHOOK_NOTIFICATION_URL`: `https://your-subdomain.ngrok-free.dev/api/square/webhook`
   - `SQUARE_WEBHOOK_ENDPOINTS`: only when the app answers on more than one hostname. One `<url>|<signature key>` pair per subscription, comma-separated.

## Testing Payments (Square Sandbox)

https://www.notion.so/Square-Sandbox-Test-Card-37b2f9f09f1880d4b6ddd31242de3b9b?source=copy_link

## Commands

```bash
pnpm dev      # Start the Next.js dev server
pnpm build    # Build for production
pnpm start    # Start the production server
pnpm lint     # Run ESLint
pnpm test     # Run the Vitest suite
pnpm seed     # Reconcile the local database to the seed data (safe to re-run)
pnpm types:supabase # Regenerate Supabase TypeScript types
```

### Seeding local data

`supabase db reset` leaves an empty database — no migration inserts rows — so run `pnpm seed`
after a reset. The script is idempotent: it matches rows on their natural key, so editing
`scripts/seed/data/*.ts` and re-running syncs your change rather than duplicating it. On the
default `local` target it also deletes seed-owned rows the data no longer describes.

```bash
pnpm seed --dry-run          # Show what would change, write nothing
pnpm seed --no-prune         # Sync without deleting anything
pnpm seed --only=events      # storage | memberships | events | users
```

Each target checks that its URL really is the environment it claims to be, so a stale
`.env.local` can't redirect a run. See [`scripts/seed/README.md`](scripts/seed/README.md) for
the `prod` target and the fixture login accounts.

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
