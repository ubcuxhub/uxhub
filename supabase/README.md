# Supabase — schema changes & debugging

This folder holds the database migrations and Supabase CLI project files. Read
this before changing the schema, and use the debugging checklist below when a
schema change breaks the app.

All table access in the app goes through one data-access boundary:
**`src/lib/supabase-helpers/`**. Pages, hooks, and components call domain
helpers (e.g. `fetchEventById`) instead of writing `supabase.from("...")`
directly. When the schema changes, you usually only need to edit the matching
helper file plus the `TABLES` map — not every call site.

## When you change the schema

Do these steps in order:

1. **Write a focused migration.**

   ```bash
   supabase migration new <describe_change>
   ```

   Keep it small and single-purpose. Never edit a migration that has already
   been applied — add a new one.

2. **Apply it.**

   ```bash
   supabase db push
   ```

3. **Regenerate the TypeScript types.**

   ```bash
   pnpm types:supabase
   ```

   This overwrites `src/lib/supabase/database.types.ts`. Commit the result.

4. **Update the data-access layer** (`src/lib/supabase-helpers/`):
   - Update the relevant helper's `select(...)` list, insert/update payloads,
     and return types.
   - If a table was renamed/added/removed, update
     [`tables.ts`](../src/lib/supabase-helpers/tables.ts) (the `TABLES` map).
   - If a column used in a realtime `filter` or an embedded foreign-key hint
     join changed, update those strings too (see "type-safety gaps" below).

5. **Validate.**

   ```bash
   pnpm exec tsc --noEmit
   pnpm lint
   pnpm build
   ```

## Table → helper map

Start here when a schema edit breaks something — find the table, open the
helper file, and fix it in one place.

| Table                          | Helper file                                          |
| ------------------------------ | ---------------------------------------------------- |
| `events`                       | `src/lib/supabase-helpers/events.ts`                 |
| `event_registrations`          | `src/lib/supabase-helpers/event-registrations.ts`    |
| `event_application_questions`  | `src/lib/supabase-helpers/event-applications.ts`     |
| `event_application_responses`  | `src/lib/supabase-helpers/event-applications.ts`     |
| `check_in_sessions`            | `src/lib/supabase-helpers/check-ins.ts`              |
| `check_ins`                    | `src/lib/supabase-helpers/check-ins.ts`              |
| `user_info`                    | `src/lib/supabase-helpers/users.ts`                  |
| `membership_types`             | `src/lib/supabase-helpers/memberships.ts`            |
| `user_info` (service-role)     | `src/lib/supabase-helpers/admin-server.ts`           |

Supporting files:

- `src/lib/supabase-helpers/types.ts` — the shared `DbClient` type. Every
  helper accepts a `DbClient` so the same function works on the browser client,
  the server client, and in tests.
- `src/lib/supabase-helpers/tables.ts` — the `TABLES` name map.
- `src/lib/supabase/admin.ts` — the service-role client. Server-only; bypasses
  Row Level Security. Only `admin-server.ts` and privileged route handlers
  import it.

## Type-safety gaps to watch (these do NOT fail `tsc`)

The generated types check `.from(...)` queries, but a few things are plain
strings the compiler cannot validate. A rename here breaks silently at runtime:

- **Realtime subscriptions** — `postgres_changes` `table` and `filter` values.
  Tables are referenced via `TABLES` (e.g. in the admin check-in page and
  sidebar), but `filter` strings like `event_id=eq.${id}` still hard-code
  column names. Update them when the filtered column changes.
- **Embedded foreign-key hint joins** — e.g.
  `membership_types!membership_type_id(name)` in `fetchAdminUserRecords` and
  `user_info!user_id(name, email)` in `fetchAttendingRegistrations`. These
  embed relationship/FK names that change with schema edits.

## Debugging checklist when something breaks

- **Stale types?** Re-run `pnpm types:supabase` and `pnpm exec tsc --noEmit`.
  A mismatch between `database.types.ts` and the live schema is the most common
  cause.
- **Renamed table/column not reflected in a helper?** Check the helper file
  from the table map above and the `TABLES` map.
- **Realtime not updating / errors?** Check `postgres_changes` `table`/`filter`
  strings (see type-safety gaps).
- **Join returns null/empty unexpectedly?** Check the embedded FK-hint join
  strings.
- **RLS errors (e.g. rows missing or writes rejected)?** Review the policies in
  the migrations. Anon-key access (the typed helpers) is governed by RLS;
  service-role helpers in `admin-server.ts` bypass it.
- **A write "succeeds" but nothing changes?** The service-role client in
  `src/lib/supabase/admin.ts` is intentionally untyped, so writes to columns
  that don't exist are not caught at compile time and may fail silently at
  runtime. Verify the column names against `database.types.ts`.

## Migration guidelines

- Create new migrations; never edit applied ones.
- Keep migrations small and one-purpose with descriptive names.
- For breaking changes, prefer a compatibility path: add the new column,
  backfill, update helpers, then drop the old column in a later migration. This
  reduces branch conflicts and deployment risk.
- Don't mix `supabase db pull` and `supabase db push` in the same workflow.
