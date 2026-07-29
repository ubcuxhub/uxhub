# Local Supabase Setup

Run Supabase locally with Docker so development does not affect the deployed database.

## 1. Install prerequisites

- Install and open [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- Install project dependencies:

```bash
pnpm install
```

## 2. Start Supabase

From the repository root, run:

```bash
pnpm exec supabase start
```

The first start downloads the required Docker images and may take a few minutes.

## 3. Configure the app

Display the local URLs and keys:

```bash
pnpm exec supabase status
```

In `.env.local`, replace the deployed Supabase values with the local values shown by that command:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
SUPABASE_SECRET_KEY=<local service_role key>
```

Keep the existing Square variables unchanged. Do not commit `.env.local`.

## 4. Prepare the database

Apply all migrations and seed data to a fresh local database:

```bash
pnpm exec supabase db reset
```

This deletes only local Docker data. Avoid adding `--linked`, which targets the deployed project.

## 5. Run the app

```bash
pnpm dev
```

- App: <http://localhost:3000>
- Supabase Studio: <http://127.0.0.1:54323>

## Everyday commands

```bash
# Check local services and credentials
pnpm exec supabase status

# Rebuild the local database from migrations
pnpm exec supabase db reset

# Stop local Supabase
pnpm exec supabase stop
```

After changing `.env.local`, restart `pnpm dev`.
