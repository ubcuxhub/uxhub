# Supabase — schema changes & debugging

This folder holds the database migrations and Supabase CLI project files. Read
this before changing the schema, and use the debugging checklist below when a
schema change breaks the app.

All table access in the app goes through one data-access boundary:
**`src/lib/supabase-helpers/`**. Pages, hooks, and components call domain
helpers (e.g. `fetchEventById`) instead of writing `supabase.from("...")`
directly. When the schema changes, you usually only need to edit the matching
helper file plus the `TABLES` map — not every call site.

## Rebuild the local database

Docker must be running. The repository uses ports `15430`–`15437` because the
default Supabase `5432x` range can be reserved by Docker Desktop on Windows.
Set `.env.local` to the local values printed by `pnpm exec supabase status`;
the API URL is `http://127.0.0.1:15431`.

From the repository root, agents and developers can run:

```bash
pnpm supabase:local
```

This runs [`reset-local.sh`](reset-local.sh), which starts Supabase, destroys
existing local database data, applies every migration in `supabase/migrations`,
and runs the idempotent TypeScript seed reconciler. It never targets the linked remote database.

The seed data lives under `scripts/seed/data/` and includes memberships, past,
ongoing, and upcoming events, purchases, tickets, applications, check-ins, and these
twelve local login fixtures (all use password `123456`). Ten cover every
membership state crossed with admin and non-admin, one is the dedicated
manager, and `new-member@example.com` starts member setup at step 1. The grid is listed in
[`scripts/seed/README.md`](../scripts/seed/README.md); the most useful are:

- `admin-explorer@example.com` — administrator with an Explorer membership
- `manager-no-membership@example.com` — manager without a membership
- `no-membership@example.com` — basic user without a membership
- `student-innovator@example.com` — basic user with an Innovator membership

To sync seed changes without destroying local data, run `pnpm seed`. Use
`pnpm seed --dry-run` to preview the reconciliation.

### What `pnpm seed` deletes

The seed reconciles *to* its data, so by default it also removes seed-owned rows
the data no longer describes. That is what makes event checkout re-testable:
buy a ticket as one of the fixture accounts, re-run `pnpm seed`, and the
purchase and ticket are gone, so the event is buyable again.

Deletion is scoped by ownership, not by table:

| Prunable                                                  | Never touched                                          |
| --------------------------------------------------------- | ------------------------------------------------------ |
| Events and membership tiers whose slug is not in the data\* | Auth users and profiles created by hand                |
| Mentors, sponsors, check-in sessions, application questions | Purchases, tickets and applications belonging to any other account |
| Purchases, tickets and applications belonging to the fixture accounts | Covers uploaded through the admin UI (`covers/`)       |
| Cover images under the `seed/covers/` storage prefix       |                                                        |

\* This includes events created through the admin UI. Such an event survives
only if a non-fixture purchase points at it — `purchases.event_id` is
`on delete restrict`, so somebody else's ticket keeps the event alive and the run
says so instead of forcing it.

Pass `--no-prune` to sync without deleting anything. The `prod` target never
deletes at all.

Cover images come from `scripts/seed/data/images` (square PNGs) and are uploaded
into the `event-images` bucket; fixtures reference them by file name through
`imageKey`, and `image_url` is filled in at run time.

## When you change the schema

Do these steps in order:

1. **Write a focused migration.**

   ```bash
   pnpm exec supabase migration new <describe_change>
   ```

   Keep it small and single-purpose. Never edit a migration that has already
   been applied — add a new one. Keep the timestamp the CLI generates: a
   hand-picked future one makes every migration created after it sort before
   it, and `db push` refuses those as out of order.

2. **Try it locally.**

   ```bash
   pnpm supabase:local
   pnpm test:rls
   ```

   This rebuilds the local database from every migration, so a broken one
   fails here instead of on the hosted project.

3. **Regenerate the TypeScript types.**

   ```bash
   pnpm types:supabase
   ```

   This reads the local database you just rebuilt, through its `postgres-meta`
   service, and overwrites `src/lib/supabase/database.types.ts`. Commit the
   result. CI runs the same command against a database built from every
   migration and fails if the committed file differs, so the types always
   match the migrations. The output depends on the `postgres-meta` version, so
   the command refuses to run against a stack started by an older CLI; restart
   it with `pnpm exec supabase stop && pnpm exec supabase start`.

4. **Merging deploys it.** The production build on Vercel
   (`scripts/vercel-build.sh`) runs `supabase db push` before `next build`, so
   the migration reaches the hosted project before the build prerenders against
   it and before the new code takes traffic. A failed migration fails the build,
   and the current deployment keeps serving. Preview builds never touch the
   hosted database.

   The old code keeps serving while the new build runs, and a rollback does not
   undo a migration, so the migration must not break the code already in
   production (see the compatibility path under "Migration guidelines").
   `db push` is forward-only; correct a bad migration with a new one.

   The one exception is a migration that fails in production. Each migration
   runs in one transaction, so production never applied it, and a later
   migration cannot help because the failing one runs first. Fix that file in
   place, say so in the pull request, and rebuild local databases that applied
   the old version with `pnpm supabase:local`. A backfill that depends on
   production data is worth a read-only preflight query first (see
   [`docs/rollouts/unified-events.md`](../docs/rollouts/unified-events.md)).
   `db push` prints neither `NOTICE` nor `WARNING` messages; a `WARNING` still
   reaches the Postgres logs in the Supabase dashboard.

   CI fails a pull request whose new migration sorts before the newest one on
   `main`, since `db push` would refuse it. That check can go stale while a PR
   waits, so rerun it, or update the branch, after another migration merges.

   To check a risky migration against production data before it ships, push it
   yourself first; the build then finds nothing to apply:

   ```bash
   pnpm exec supabase db push
   ```

   The build needs `SUPABASE_MIGRATIONS_DB_URL` in Vercel's Production
   environment: the session-mode pooler connection string (port 5432, from the
   dashboard's Connect panel) with the password percent-encoded. The direct
   host is IPv6-only, which Vercel's build machines cannot reach. Production
   builds only run from `main`; to undo a deploy use Instant Rollback, because
   redeploying an older commit fails when the hosted history has migrations
   that commit lacks.

5. **Update the data-access layer** (`src/lib/supabase-helpers/`):
   - Update the relevant helper's `select(...)` list, insert/update payloads,
     and return types.
   - If a table was renamed/added/removed, update
     [`tables.ts`](../src/lib/supabase-helpers/tables.ts) (the `TABLES` map).
   - If a column used in a realtime `filter` or an embedded foreign-key hint
     join changed, update those strings too (see "type-safety gaps" below).

6. **Validate.**

   ```bash
   pnpm exec tsc --noEmit
   pnpm lint
   pnpm build
   ```

## Table → helper map

Start here when a schema edit breaks something — find the table, open the
helper file, and fix it in one place.

| Table                         | Helper file                                       |
| ----------------------------- | ------------------------------------------------- |
| `event_date_location_settings` | `src/lib/supabase-helpers/event-date-locations.ts` (staff editor only) |
| `events`                      | `src/lib/supabase-helpers/events.ts`              |
| `event_tickets`               | `src/lib/supabase-helpers/event-tickets.ts`       |
| `event_applications`          | `src/lib/supabase-helpers/event-applications.ts`  |
| `event_application_questions` | `src/lib/supabase-helpers/event-applications.ts`  |
| `event_application_responses` | `src/lib/supabase-helpers/event-applications.ts`  |
| `event_agenda_days`           | `src/lib/supabase-helpers/event-agenda.ts`        |
| `event_agenda_items`          | `src/lib/supabase-helpers/event-agenda.ts`        |
| `event_agenda_notes`          | `src/lib/supabase-helpers/event-agenda-notes.ts` (staff only; `save_agenda_note` enforces revisions and event membership) |
| `check_in_sessions`           | `src/lib/supabase-helpers/check-ins.ts`           |
| `check_ins`                   | `src/lib/supabase-helpers/check-ins.ts`           |
| `mentors` / `event_mentors`   | `src/lib/supabase-helpers/event-people.ts`        |
| `sponsors` / `event_sponsors` | `src/lib/supabase-helpers/event-people.ts`        |
| `application_emails.deliveries` (private, RPCs only) | `src/lib/supabase-helpers/application-emails.ts` |
| `event_reminders.sends` (private, RPCs only) | `src/lib/supabase-helpers/event-reminders.ts` |
| `user_info`                   | `src/lib/supabase-helpers/users.ts`               |
| `membership_types`            | `src/lib/supabase-helpers/memberships.ts`         |
| `purchases`                   | `src/lib/supabase-helpers/purchases.ts`           |
| `square_webhook_events`       | `src/lib/supabase-helpers/purchases.ts`           |
| `app_settings`                | `src/lib/supabase-helpers/app-settings.ts`        |
| `user_info` (service-role)    | `src/lib/supabase-helpers/admin-server.ts`        |
| `event-images` (storage)      | `src/lib/supabase-helpers/admin-server.ts`        |
| `application-files` (storage) | `src/lib/supabase-helpers/application-files.ts`   |

Supporting files:

- `src/lib/supabase-helpers/types.ts` — the shared `DbClient` type. Every
  helper accepts a `DbClient` so the same function works on the browser client,
  the server client, and in tests.
- `src/lib/supabase-helpers/tables.ts` — the `TABLES` name map.
- `src/lib/supabase/admin.ts` — the service-role client. Server-only; bypasses
  Row Level Security. Import it only from server-side code that checks
  authorization itself: today `admin-server.ts`, the admin server actions, and
  the payment customer and fulfillment modules.
  `grep -rln 'supabase/admin"' src` lists every importer.

## Shared staff agenda notes

`event_agenda_notes` stores one unbounded text note per stable agenda item,
separately from participant descriptions, public projections and builder revisions.
Only admin/manager viewers can read it. Anonymous access and direct browser
insert/update/delete are denied. The viewer-client `save_agenda_note` RPC checks
staff authorization, item/event membership and the expected note revision in one
transaction. A missing note starts at revision 0; each successful save increments
it. A stale save returns the latest note without overwriting it. Empty text clears
the note. Deleting an eligible agenda item cascades its note.

`event-agenda-notes.ts` reads the normalized agenda regardless of the participant
display switch and joins staff-only locations/notes. Call it only after the
server staff guard, with the requesting viewer's client. The participant reader
continues to omit all staff notes and Volunteer Schedule URLs.

## Storage

Admin user photos use a separate public `profile-photos` bucket (JPEG/PNG,
4 MiB maximum). Managers upload through `/api/admin/users/[userId]/photo`;
the server validates the image and writes with the service-role client.
There are no direct client write policies. Anyone holding a public photo URL
can view it.

`user_info.profile_photo_path` stores an object key shaped as
`profiles/<user-id>/<uuid>.<ext>`, and the UI derives its public URL. Replacements
compare the previous path before saving, then delete the old object. Failed
saves clean up the newly uploaded object. Account deletion clears the database
reference and attempts storage cleanup after anonymization. Cleanup failures
are logged and do not undo a successful database change.

The four admin-profile migrations also add manual student verification,
`birth_date`, and `interests`. Those columns deliberately have no authenticated
UPDATE grants: managers edit through authorized server endpoints, and members
edit their own `interests` through server actions (setup and Settings). The
later member setup migration does grant members UPDATE on its own columns
(`setup_step`, `diets`, `allergies`, `other_allergies`, `avatar_preset`), held
to valid values by CHECK constraints, and the one after it on
`user_type_confirmed_at` (whether the member answered "What best describes
you?"; null means never asked, since `user_type` always has a default).
`user_type` itself stays privileged: the setup and membership actions change
it with the service role, and only without an active or pending membership. Anonymization triggers clear all four additions during
the existing `delete_account` transaction; changes to student number or user
type invalidate manual verification.

[`user-profile.integration.test.ts`](../src/features/admin/user-profile.integration.test.ts)
exercises these actions, database constraints, access controls, and Storage
through `pnpm test:integration`. It uses the shared fixtures in
[`src/test/integration.ts`](../src/test/integration.ts), which also remove the
photos a test uploads, and acts as a member by signing a local JWT rather than
signing in.

Event cover images live in the public `event-images` bucket. Bucket names are
centralized in [`buckets.ts`](../src/lib/supabase-helpers/buckets.ts), the same
way table names are in `tables.ts`.

Uploads go through the service-role client, which bypasses RLS. Public reads are
served by `/storage/v1/object/public/event-images/...` without an RLS check
because the bucket is public. `storage.objects` ships default-deny for `anon` and
`authenticated`, which is the posture we want, so there are deliberately **no
`storage.objects` policies** — don't add them expecting to fix something.

The bucket is provisioned in two places, and they are not redundant:

| Environment          | Mechanism                                          |
| -------------------- | -------------------------------------------------- |
| Remote / production  | the migration, applied by the production build's `supabase db push` |
| Local                | `pnpm seed` (`--only=storage` to run just this)     |

Seeding provisions the bucket locally so a fresh database is usable straight
away. `pnpm seed --target=prod` does the opposite: it checks the bucket exists
and fails with a `db push` instruction if it does not, rather than papering over
a deploy that never ran. Keep the bucket settings in `scripts/seed/index.ts` in
sync with the migration by hand.

Objects uploaded through the app are keyed `covers/<slug>-<uuid>.<ext>`. The key
is unique per upload rather than derived from the event name: public storage
URLs are CDN-cached with a long `cache-control`, so reusing a key would serve a
stale image after a cover is replaced.

Seed covers use the separate `seed/covers/<file>` prefix and stable keys, since
the seed wants idempotency more than cache-busting (they carry a short
`cache-control` instead). The split prefix is also what lets `pnpm seed` clear
stale seed images without ever deleting a cover somebody uploaded by hand.

Application files live in the private `application-files` bucket (PDF, 5 MB),
keyed `<user_info_id>/<application_id>/<question_id>/<file name>`; the answer
to a file question stores that key. Unlike the two public buckets, members
upload and remove these themselves with their own session, so this bucket
**does** have `storage.objects` policies
(`20261106193115_application_files_bucket.sql`): members write only into their
own draft, under a file question of its event, and remove only while it is a
draft; they read their own files, and admins read those of submitted
applications. Downloads use short-lived signed URLs
(`createApplicationFileUrl`). The app never deletes a member's draft (the
apply page has no Delete), and the database cannot reach Storage, so anything
that deletes one must remove its files first.

## Type-safety gaps to watch (these do NOT fail `tsc`)

The generated types check `.from(...)` queries, but a few things are plain
strings the compiler cannot validate. A rename here breaks silently at runtime:

- **Realtime subscriptions** — `postgres_changes` `table` and `filter` values.
  Tables are referenced via `TABLES` (e.g. in the admin check-in page and
  sidebar), but `filter` strings like `event_id=eq.${id}` still hard-code
  column names. Update them when the filtered column changes.
- **Embedded foreign-key hint joins** — e.g.
  `membership_types!membership_type_id(name)` in `fetchAdminUserRecords` and
  `user_info!user_id(first_name, last_name, email)` in
  `fetchCheckInAttendees`. These
  embed relationship/FK names that change with schema edits.

## Debugging checklist when something breaks

- **Stale types?** Rebuild with `pnpm supabase:local`, re-run
  `pnpm types:supabase`, and run `pnpm exec tsc --noEmit`. If the types are
  right but production misbehaves, check that every migration was pushed:
  `pnpm exec supabase migration list`.
- **Renamed table/column not reflected in a helper?** Check the helper file
  from the table map above and the `TABLES` map.
- **Realtime not updating / errors?** Check `postgres_changes` `table`/`filter`
  strings (see type-safety gaps).
- **Join returns null/empty unexpectedly?** Check the embedded FK-hint join
  strings.
- **RLS errors (e.g. rows missing or writes rejected)?** Run `pnpm test:rls`
  first — it exercises every policy against the local database as anon, a
  member, an admin, and a manager, and names the first one that misbehaves.
  Then review the policies in the migrations. Anon-key access (the typed helpers) is governed by RLS;
  service-role helpers in `admin-server.ts` bypass it.
- **A write "succeeds" but nothing changes?** The service-role client in
  `src/lib/supabase/admin.ts` is intentionally untyped, so writes to columns
  that don't exist are not caught at compile time and may fail silently at
  runtime. Verify the column names against `database.types.ts`.

## Migration guidelines

### Publication watchdog

The publication watchdog migration creates private state and a conditional
`check-event-publication` job. No application role has access to this schema.
Publication continues without notification configuration, but each health-check
attempt records `configuration_missing` until configuration is supplied.

Deploy the `/api/internal/event-publication` endpoint and configure a random,
dedicated `EVENT_PUBLICATION_HEALTH_SECRET` in the server environment. In the
hosted SQL editor, store the same value in Vault under
`event_publication_health_secret`, and the full production HTTPS endpoint URL
under `event_publication_health_url`. Use Vault's secret creation/update UI or
parameterized SQL; do not commit values. Sentry's DSN must also be configured
for alerts. Set these up before allowing a production monitoring window to run.
Preview/local databases must never point to the production notification URL.

Requests use a SHA-256 HMAC over `event-publication:<unix-seconds>`, passed in
`x-publication-signature`, with the timestamp in `x-publication-timestamp`.
The endpoint accepts signatures within five minutes of server time. This keeps
the shared secret out of pg_net's database-readable request queue. See the
[Supabase queue credential guidance](https://supabase.com/kb/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net).

Before pushing, inspect `supabase_migrations.schema_migrations` and count legacy
scheduled rows (`status = 'active' and publish_at > now()`). The unapplied
activation migration preserves those rows as scheduled drafts. Apply migrations
before merging; the watchdog has no dependency on the new endpoint until its
notification secrets are configured.

Inspect bounded attempts and HTTP delivery from a privileged SQL connection:

```sql
select w.event_id, w.publish_at, w.expected_run_at, w.attempts,
       w.next_check_at, w.last_delivery_status, w.last_response_status,
       request.id as request_id, r.status_code, r.timed_out
from event_publication.watchdog w
left join lateral unnest(w.request_ids) request(id) on true
left join net._http_response r on r.id = request.id;
```

The endpoint reads `public.event_publication_health(before)` (service role
only), which returns the drafts still unpublished at `before`, the blocked
drafts, and the blocked event ids. It logs `event.publication_overdue` at error
level, which Sentry alerts on, with `count` (overdue), `blocked`, `eventIds`
(the blocked ids, comma-separated) and `before`, whenever either count is above
zero.

A draft the publisher cannot activate for a lasting reason (anything but a
lock timeout, serialization failure or deadlock, cancelled statement, or
resource limit) is recorded in the private `event_publication.blocked` table at
its current `publish_at`. The publisher no longer sets the minute job for it,
and the hourly `recover-event-publication` run retries it, counting each
failure. `reason` is the error's hint (such as `EVENT_PUBLICATION_INVALID`) or
its SQLSTATE, never the message, which can quote row data; the run's WARNING
carries the event id, SQLSTATE and hint. Changing the draft's publish date,
publishing it by hand, or deleting it clears the block. Inspect blocks from a
privileged SQL connection:

```sql
select b.event_id, b.publish_at, b.reason, b.failures,
       b.first_failed_at, b.last_failed_at
from event_publication.blocked b
order by b.first_failed_at;
```

Three attempts with `next_check_at is null` means monitoring is exhausted.
`last_delivery_status` captures configuration/enqueue outcomes and
`last_response_status` captures responses observed by later checks; the final
response is read using the query above. pg_net
responses expire according to `pg_net.ttl` (six hours by default). Ordinary edits
and publisher retries cannot restart exhausted windows. Correct the delivery
configuration and deliberately change the event's publication date to rearm it.
Use a non-sensitive test draft to verify an overdue alert reaches Sentry after
deployment; local tests cover scheduling and authentication without sending
external HTTP requests.

### Application emails

Applicants are emailed their released decision and a reminder 24 hours before
an accepted offer expires (`docs/event-states.md`, "Application emails"). The
migration `*_application_emails.sql` adds:

- the private `application_emails` schema, whose `deliveries` table records
  one row per email per application, unique on `(application_id, kind, key)`
  (`key` is the status for a decision, the deadline for a reminder). No
  application role, the service role included, can reach it directly;
- `claim_application_emails(p_limit, p_event_ids)`,
  `complete_application_email(p_delivery_id, p_sent, p_error_code)` and
  `release_application_emails(p_delivery_ids, p_reason)`, service role only.
  A failed send hands its claim back for the next run, up to five attempts; a
  release (Resend's rate limit or quota, or no API key) doesn't count one. A
  claim the route never completed is retried after 15 minutes;
- a backfill that marked every email already due as sent (`last_error_code =
  'BACKFILL'`), so deploying emailed nobody;
- the `send-application-emails` pg_cron job, every five minutes. When an email
  is due and both Vault secrets below exist, it POSTs to the stored URL, signed
  like the publication watchdog: a SHA-256 HMAC over
  `application-emails:<unix-seconds>` in `x-application-emails-signature`,
  the timestamp in `x-application-emails-timestamp`. Without either secret it
  does nothing.

Preview deploys share the production database, so the job calls only the URL in
Vault, and only production has it. `/api/internal/application-emails` checks
the signature within five minutes of server time, returns `{"skipped":"flag"}`
while `FLAGS.studentEvents` is off, and otherwise sends up to 25 emails, 600 ms
apart, through `sendEmail`. On Resend's `rate_limit_exceeded`,
`daily_quota_exceeded` or `monthly_quota_exceeded` it hands back the rest and
stops until the next run. The free tier allows about 100 emails a day, so a
large release can take more than a day to drain.

To turn it on, before the student-events flag goes on in production:

1. Make a random secret (`openssl rand -hex 32`) and set it as
   `APPLICATION_EMAILS_SECRET` in Vercel's **Production** environment only.
   `RESEND_API_KEY` and `EMAIL_FROM` must already be set there, with the
   sending domain verified in Resend.
2. In the hosted SQL editor, store the same value in Vault as
   `application_emails_secret`, and the endpoint as `application_emails_url`:
   `https://www.ubcuxhub.ca/api/internal/application-emails`. Use the `www`
   host: the apex domain answers with a 307 redirect. Use Vault's UI or
   parameterized SQL, and never commit either value.
3. Redeploy production so the function reads the new variable.

Never store these secrets in a preview or local database's Vault. Logs carry
ids and codes only: `application.email_sent` (info), `application.email_failed`
and `application.email_paused` (warn), and `application.email_abandoned` (error,
after the fifth failure), `application.email_claim_failed` and
`application.email_record_failed` (error). Inspect deliveries and the job's
calls from a privileged SQL connection:

```sql
select d.kind, d.key, d.claimed_at, d.sent_at, d.attempts, d.last_error_code,
       d.application_id
from application_emails.deliveries d
order by d.created_at desc
limit 50;

select r.id, r.status_code, r.timed_out, r.created
from net._http_response r
order by r.created desc
limit 10;
```

To send an abandoned email again, reset its row (`attempts = 0,
last_error_code = null`); it goes out on the next run.

### Event reminder emails

Ticket holders get a reminder before an event starts, as its admins choose in
the builder's Registration section ("Reminder email"). The migration
`*_event_reminder_emails.sql` adds:

- `events.reminder_schedule`: `off`, `1d` (a day before), `2h` (two hours
  before) or `both`. The column defaults to `off`, so every event that existed
  when it shipped sends nothing; the builder starts a new event at `1d`
  (`getInitialFormState`), and a working draft saved before the field existed
  reads as `off`. The builder's save writes it like any other events column
  (`save_admin_event_builder` copies every payload key that names one);
- the private `event_reminders` schema, whose `sends` table records one row
  per ticket and kind (`1d` or `2h`), unique on `(ticket_id, kind)`, so nobody
  gets the same reminder twice. Voiding or fully refunding a ticket deletes
  it, and its rows with it. No application role, the service role included,
  can reach it directly;
- `claim_event_reminders(p_limit, p_event_ids)`,
  `complete_event_reminder(p_send_id, p_sent, p_error_code)` and
  `release_event_reminders(p_send_ids, p_reason)`, service role only, with the
  same retries as the application emails: five attempts, releases don't
  count, a claim the route never completed is retried after 15 minutes;
- the `send-event-reminders` pg_cron job, every 15 minutes. When a reminder is
  due and both Vault secrets below exist, it POSTs to the stored URL with a
  SHA-256 HMAC over `event-reminders:<unix-seconds>` in
  `x-event-reminders-signature` and the timestamp in
  `x-event-reminders-timestamp`. It signs with `application_emails_secret`:
  the message differs, so neither job's signature opens the other's route.

A reminder is due (`event_reminders.due_work`) for each ticket of an active,
uncanceled event whose setting includes its kind, held by an account that
isn't deleted, whose ticket existed at the send time (someone who registers
after it doesn't get that reminder), and whose purchase isn't refunded in
full. The send time is 24 or 2 hours before `starts_at`, which is the first
day of a multi-day event. A reminder stays due until it would read wrong: six
hours after its send time for the day-before one ("See you tomorrow"), the
start for the two-hour one. After that it is dropped, so a quota or an outage
can cost a reminder but never sends a stale one. Turning the setting off
stops reminders not yet sent; sent ones stay sent, and turning it on again
doesn't repeat them.

`/api/internal/event-reminders` checks the signature with
`APPLICATION_EMAILS_SECRET` within five minutes of server time, returns
`{"skipped":"flag"}` while `FLAGS.studentEvents` is off, and otherwise sends
up to 50 reminders, 600 ms apart, through `sendEmail`, stopping on Resend's
rate limit or quota like the application emails. The free tier's ~100 emails
a day are shared with every other email the app sends.

To turn it on in production, once the application emails are set up (it
needs `APPLICATION_EMAILS_SECRET` in Vercel and `application_emails_secret`
in Vault):

1. In the hosted SQL editor, store the endpoint in Vault as
   `event_reminders_url`: `https://www.ubcuxhub.ca/api/internal/event-reminders`
   (the `www` host, as above). Use Vault's UI or parameterized SQL.
2. Nothing to redeploy: the route reads the variable the application emails
   already use.

Never store these secrets in a preview or local database's Vault. Logs carry
ids and codes only: `event.reminder_sent` (info), `event.reminder_failed` and
`event.reminder_paused` (warn), and `event.reminder_abandoned`,
`event.reminder_claim_failed` and `event.reminder_record_failed` (error).
Inspect sends from a privileged SQL connection:

```sql
select s.kind, s.claimed_at, s.sent_at, s.attempts, s.last_error_code,
       s.ticket_id
from event_reminders.sends s
order by s.created_at desc
limit 50;
```

### General rules

- Create new migrations; never edit applied ones.
- Keep migrations small and one-purpose with descriptive names.
- For breaking changes, prefer a compatibility path: add the new column,
  backfill, update helpers, then drop the old column in a later migration. This
  reduces branch conflicts and deployment risk.
- Don't mix `supabase db pull` and `supabase db push` in the same workflow.
- **Migrations no longer own membership tier copy.** Admins edit
  `membership_types.description`, `price`, and `active` on `/admin/settings`, so
  a migration that writes those columns silently overwrites what they typed.
  `20260907120000_simplify_membership_benefits.sql` set the descriptions
  because no other path reached the production rows; it is the last of its kind.
  `name` and `slug` are not editable, so they stay migration-owned.

## Event builder dates and locations

`event_date_location_settings` stores the staff-only editor document and revision,
including inactive location-type values and per-date whole-location overrides.
Never include this table in member/public payloads. The atomic save synchronizes
one check-in session per date, retains session IDs, derives the events envelope,
and writes only the audience-approved summary/physical fields to `events`.
Exact restricted physical details stay in the editor document; default meeting
details also use the existing Going/staff `event_private_details` boundary.
Member per-date/physical-private rendering and broader audience integration remain
deferred under the form-first spec. Registration capacity and mode are guarded
on all event writes using the same event row lock as reservations.


### Application form configuration

`event_application_settings` stores staff-only release/confirmation configuration
and the durable first-submission question lock. Browser roles have only RLS-scoped
staff reads; writes run through the authorized builder transaction or submission
trigger. `save_event_application_questions` and direct question-write triggers
serialize on the event row with `submit_event_application`; submitted questions
remain unchanged even when they have no answers. No migration rewrites offers,
responses or attachment objects. Timing fields are configuration only until the
attendee release/offer integration is implemented. See
[application editor settings](../docs/event-states.md#application-editor-settings).

### Team form configuration

The builder reuses `events.teams_enabled`, nullable min/max sizes and deadline.
No retains hidden configuration. `guard_event_team_settings` blocks disabling
formed teams (including empty/ownerless teams) and lowering max below the largest
team. Team creation/growth and settings writes serialize on the event row; the
existing attendee RPCs take that lock before their checks and team locks. Direct
service-role team writes also honor enabled/capacity guards. No memberships or
historical records are rewritten. `admin_event_team_settings` supplies staff-only
aggregate editor locks via `src/lib/supabase-helpers/teams.ts`. Member/invite and
staff assignment interfaces remain deferred; nullable limits and deadline keep
their existing unlimited/no-lock meaning.


### People and resource form configuration

`event_content_settings` stores the staff-only ordered editor document and a
revision checked under the event row lock. Applied saves synchronize people
sections, mentor/sponsor associations and viewer-scoped `event_links` atomically
through the existing builder save chain. Directory rows have null `owner_event_id`;
new/edited event entries use owned rows and never mutate shared sources. Searches
exclude owned rows. Browser roles cannot write the document or invoke saves.
Every included section needs an item, including in working drafts; incomplete
entry fields/link rows remain recoverable in working documents. HTTP(S) URL
safety is checked in application validation and the database. Going-only links
retain existing RLS after an event ends; after-event public links remain distinct.
The section-aware attendee renderer remains deferred.

## Event builder mutation safety

`events` owns the permanent event identity from the first builder Save. On a
draft, Save is a full builder save (validated, applied, keeping the
draft status); it writes a working document only as the identity step of a new
event's first save, which the same save then clears. Unscheduled drafts saved
before that change allow null descriptions, prices, capacity and dates; exact
unfinished form values and nested sections live in `working_document`, with
`working_revision`.
An explicit Free selection still means zero; an unfinished paid/legacy amount
stays null. Row RLS makes drafts staff-only. A CHECK prohibits working documents
on scheduled/published rows, so public event reads never include private payloads.
All staff readers use the working-document adapter. Draft Save, full builder Save,
quick schedule editing and publication share the event/advisory lock, revisions,
URL claims and operation receipts. Both incomplete and complete saves allocate
automatic URL collisions under the transaction lock and receipt the actual
canonical URL. Full saves refuse omitted saved nested sections. Publication
writes related tables and clears
the working document in the same transaction. Missing prices never enable checkout.

The expand migration backfills standalone drafts to their original draft UUID;
attached/materialized drafts retain the existing event UUID. `legacy_draft_ids`
records route aliases. Manual URL conflicts abort backfill with the draft ID;
automatic names receive numbered URLs. A rename updates `slug` and
`configured_slug` together and releases the old claim. First-publication locks
remain permanent. Old draft routes redirect to the canonical ID editor.

`admin_event_drafts` and the old RPC signatures remain **compatibility mirrors**
during deployment overlap. They are not application read sources. Compatible
wrappers write the unified row, and mirror saves/full-save materialization for the
old deployment. A legacy publication receipt derives from its draft ID/revision;
new callers send an operation UUID. Do not remove legacy storage/functions in this
release. After backfill verification and confirmation that all old deployments
(and pending retries) have retired, a separate contract migration may remove the
mirrors and superseded wrappers. Never drop `admin_event_mutations` receipts or
legacy route aliases as part of that cleanup.

Migration verification (local, rolls back all fixtures and writes):

```sh
psql postgresql://postgres:postgres@127.0.0.1:15432/postgres -v ON_ERROR_STOP=1 -f supabase/tests/unified-draft-migration.sql
```

The test replays the actual expand backfill for standalone, attached and
materialized fixtures and confirms that a manual collision blocks cutover without
losing its document. Run it with RLS and integration checks before deployment.
Follow the [staged rollout](../docs/rollouts/unified-events.md): deploy the
legacy-route redirect (#270) first, then this migration and the unified app.
The build switches application reads/writes after migrations succeed. If cutover reports a collision, resolve that saved manual URL with its
owner and rerun the deployment; do not delete or overwrite the saved document.

`events.revision` increments for every event-row update, including overview and
scheduled publication. Builder server actions send the loaded revision and a
stable operation UUID. `admin_event_mutations` stores committed responses in the
same transaction and is service-role only; retrying the same operation returns
its receipt without repeating the write. Deletion receipts retain asset cleanup
targets after the event is removed. Keep these receipts private and intact while
clients may still retry.

Ended active events use `ends_at` (final date envelope), falling back to
`starts_at`. The builder refuses full historical saves; the overview RPC refuses
schedule changes. A dedicated resource RPC validates and replaces only links,
preserving historical sections and child identities. Authenticated direct event
and child-setting writes are also locked. Trusted service-role seed/maintenance
writes remain available; first-party mutations must use the guarded actions.

### Operational event pricing and free registration

Explicit Free/Paid configuration synchronizes `regular_price` and zero
`member_price` with `pricing_policy = 'figma'`. Legacy records retain their
amounts on unrelated saves; pricing stays locked once offers, tickets or
live purchases exist. `initialize_event_checkout` is service-role only and
serializes on the event plus attempt key. It reads current membership expiry and
club term, rejects stale quotes, and snapshots a paid amount before Square.
For zero amounts it calls the existing reservation function and commits the
purchase, ticket and fulfilled status together. A rejected reservation leaves no
purchase or seat. Retries return the same receipt. No Square customer or payment
is used for zero amounts; ordinary confirmation, history and check-in read the
same purchase/ticket records as paid registration.

## Unified builder agenda (EAG-001)

Version 2 of the staff-only `event_date_location_settings.document` contains
dated days with whole locations and stable item UUIDs, descriptions, start time,
explicit end date/time, optional whole-location override and optional check-in.
Day/event envelopes are derived server-side; working-document projections use
the same items and retain incomplete text. `agenda_enabled` controls display only.
Public agenda rows contain safe physical projections, never the private editor
document or meeting credentials. Existing public time columns remain projections
for participant consumers pending EAG-002.

`check_in_sessions.agenda_item_id` maps enabled items to the current scanner.
Attendance keeps its original session/ticket/timestamp. Database guards serialize
item/session/event deletion with attendance inserts and reject disabling attended
items, including through a draft working document. Undo of attendance is separate.
Full saves keep the existing revision and operation receipt transaction. Overview
quick edits cannot change the item-derived event dates.

The 20261118012141 migration uses the approved empty-event baseline; it does not
infer/backfill legacy session mappings. Rebuild/reseed the local database with
`pnpm supabase:local`; do not deploy it against legacy live agendas without a
separate data decision. Timing reuses the application's pinned Vancouver calendar
(including historical gap/overlap rejection), independent of local tzdata.

### Participant agenda projection

`event_participant_content(event_id)` reads canonical agenda rows and projects only
participant descriptions, check-in flags and active effective day/item locations.
It authorizes with the requesting viewer, never a supplied user ID. Restricted
locations return only public summaries unless the viewer is staff or owns an
event ticket, including after the event. Accepted applications alone grant no
location access. Staff editor documents, inactive location fields and other
resources never enter the result. Call with the viewer client and keep HTML/RSC
responses private/dynamic. `agenda_enabled` hides participant RPC and direct
agenda reads while preserving staff reads and saved content. Event summary
location remains available independently of that display switch.

## Staff Volunteer Schedule

`event_staff_volunteer_schedules` stores one safe HTTPS resource per event (event
PK, stable ID, label, URL, sort order, event-delete cascade). Admin/manager viewer
clients can read it; anonymous clients lack SELECT and basic users get no rows.
Browser mutations are revoked. Server mutations require `requireAdmin()` before
using the service role. No participant resource audience enum is extended.

The staff editor includes `volunteer_schedule` as another link type, always with
`visibility: staff`. Its type, label, URL and remove controls share the existing
resource editor. Atomic saves filter it out of `event_links`, synchronize private
storage, and retain it in staff-only content/working documents. Incomplete drafts
keep unfinished rows without erasing a configured URL. `fetchEventContent` merges
the private row back into its saved position; `fetchStaffVolunteerSchedule` is the
viewer-scoped reader for the admin agenda. Generic resource readers never query it.

New editor documents use `resources_version: 2`: an omitted schedule row then means
removal. Older documents without this version preserve a schedule they never knew.
Historical resource RPC calls accept an optional `p_resources_version` argument
with the same semantics, covered by revision/retry checks. Existing RPC arguments
and generic everyone/going/after_event resource semantics remain compatible.


The staff agenda's `create_staff_volunteer_schedule` operation creates only the
initial link. It is service-role only, called after the server staff guard, and
shares builder locks and private retry receipts. Concurrent creation is rejected;
existing resources/people remain intact. Content and working-document revisions,
and unmaterialized compatibility mirrors, update atomically to reject stale saves.
It works for incomplete drafts, active events and historical events. Subsequent
edits use the event editor's Links and resources section.

## Item check-in

Staff use the viewer-client `mutate_item_check_in` RPC with event and stable item
identity. It checks staff authorization, an enabled item in that event, and a
valid ticket on every mutation, independent of event time or participant schedule
visibility. Compatibility sessions remain stored and retain their item mapping.
Authenticated direct attendance writes are revoked; legacy server actions resolve
their session to an item and call this same RPC. Unversioned legacy undo is refused.

`check_ins.attendance_version` identifies the displayed attendance. Duplicates
preserve it and the first timestamp. Undo compares it atomically; a later rescan
cannot be removed with an old version. Event/session/item locks serialize builder
changes and staff mutations. `check_in_activity` records each successful version,
its authenticated profile ID and scan/manual method; undo marks that version's
activity undone. Activity reads are staff-only and direct client writes are denied.
Old attendance lacking activity displays unknown provenance without invented data.
The new helper is `src/lib/supabase-helpers/item-check-in.ts`.
### Ticket-safety groundwork

`20261117054623_ticket_safety_groundwork.sql` defines one live-purchase rule
(`purchase_is_live`, `event_has_live_purchases`) and uses it in the pricing
lock, the registration-mode lock and event deletion instead of
`status <> 'failed'`. `event_ticket_eligibility` holds the checks that
`reserve_event_ticket` and `initialize_event_checkout` share; checkout runs it
before inserting a purchase, so a refused paid attempt never reaches Square.
`event_member_commitments` and `remove_event_ticket` are internal helpers for
later releases (refunds, void, cancel). All five are service-role only. The new
columns `events.canceled_at`/`cancellation_note` and
`purchases.refunded_cents`/`refunded_at` are not browser-writable: the events
column grants leave them out, and `purchases` has no browser update policy. See
[live purchases](../docs/event-states.md#live-purchases).

Resource-only saves for ended and canceled events share the schedule-aware
`save_past_event_resources` function. Its optional `p_resources_version` preserves
older callers and private volunteer schedules; do not add a separate four-argument
overload, which makes PostgREST calls ambiguous. The reconciliation migration
combines cancellation access with schedule synchronization and service-role grants.
