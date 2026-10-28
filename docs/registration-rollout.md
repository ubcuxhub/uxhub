# Registration rollout

Moves `event_registrations` and the legacy event columns to the schema in
[schema-proposed.sql](schema-proposed.sql) and
[event-states.md](event-states.md) without breaking the deployed code.

Migrations reach the hosted database before their code deploys, so each one
must work with the code that is live when it is pushed.

| Step | Change | Status |
| --- | --- | --- |
| [1. Add](#1-add) | New schema beside the old | Done (`20261015000005`–`10`) |
| [2. Move the code](#2-move-the-code) | Code uses only the new schema | In progress: PR A and PR B open |
| [3. Remove](#3-remove) | Drop the legacy schema | After step 2 is live |

These migrations were first numbered `20270101000001`–`10`, a future date,
so every migration made with `supabase migration new` sorted before them and
`db push` refused it. They were renamed to `20261015000001`–`10` with their
contents unchanged, and the hosted history repaired to match. Comments inside
them still cite the old numbers; the suffix is the same.

## 1. Add

Additive only, so the deployed code keeps working. The legacy schema is as
main had it.

- **`events` columns:** `publish_at`, `starts_at`, `ends_at`,
  `registration_opens_at`, `registration_closes_at`, `requires_application`.
  The `sync_legacy_event_columns` trigger copies each legacy write into them.
- **Visibility:** `event_is_public(status, publish_at)` backs the events,
  mentor and sponsor read policies, so scheduled events stay hidden.
- **Tables:** `event_tickets` and `event_applications`. Applications have their
  own enum, `event_application_status`, and a trigger enforces the allowed
  moves.
- **Links:** `check_ins.ticket_id` and
  `event_application_responses.application_id`.
- **Functions:** `event_seat_counts`, `event_seat_counts_unfiltered`,
  `reserve_event_ticket`.
- **Backfill:** `backfill_event_tickets_and_applications()` turns attending
  registrations into tickets, and registrations on `applications_enabled`
  events into applications. Safe to repeat.

`pnpm supabase:local` leaves the ticket and application tables empty, since the
seed writes registrations only.

## 2. Move the code

Two PRs, one after the other. PR A moves tickets, applications and check-in;
PR B moves the legacy date columns to `starts_at`, `ends_at`,
`registration_opens_at` and `registration_closes_at`, and drops the Archived
option from the event form.

### PR A: tickets, applications, check-in

`20261028223807_move_code_to_event_tickets` runs first, while step 1's code is
still live. It:

- re-runs `backfill_event_tickets_and_applications()` to pick up writes since
  step 1;
- makes `check_ins.event_registration_id` and
  `event_application_responses.event_registration_id` nullable;
- turns the partial unique indexes on `(ticket_id, check_in_session_id)` and
  `(event_application_question_id, application_id)` into plain unique
  constraints, so the code can upsert on them;
- adds `event_tickets` to the `supabase_realtime` publication for the
  check-in page;
- replaces `save_admin_event_atomically` with one that writes an `events`
  column only when the payload has its key, so the old and new admin forms
  both save, and keeps the publish scheduling of `20261027230345`;
- adds `release_event_ticket(purchase_id)`, service role only. It deletes the
  purchase's ticket unless the purchase is `completed` or the ticket has a
  check-in.

Then the code:

- **Fulfillment** reserves with `reserve_event_ticket`, releases with
  `release_event_ticket`, and finds an existing ticket by purchase or user.
  The database enforces applications and offers, so fulfillment no longer
  checks questions. Admins and managers can buy a ticket for a draft or
  scheduled event, from the portal event page, which shows a draft banner.
- **Applications:** members insert into `event_applications` and responses go
  by `application_id` (`insertEventApplication`, `upsertApplicationResponses`;
  no student form calls them yet). Admin review uses
  `event_application_status`, requires an offer deadline to accept, and shows
  Accepted, Registered and Offer expired. The review route param is
  `[applicationId]`; backfilled applications kept their registration's id, so
  old links still resolve.
- **Check-in** lists tickets and writes `check_ins` by `ticket_id` only.
  Unchecking deletes the check-in.
- **Counts** come from `event_seat_counts`: tickets on the admin events table,
  seats left on the public event page.
- **Seed** writes tickets and applications, and prunes every
  `event_registrations` row a fixture account still holds.
- `event-registrations.ts` and `TABLES.eventRegistrations` are gone.

There is no free-ticket path: every ticket goes through Square, as before.
Registrations written by the old code between this migration's push and PR A's
deploy are not backfilled; step 3 runs the backfill once more before dropping
anything.

### PR B: event dates, `requires_application`, Archived

`20261028235900_drop_legacy_registration_defaults` runs first. It drops the
`now()` and `now() + 7 days` defaults from `registration_start_time` and
`registration_end_time`. On insert, `sync_legacy_event_columns` copies those
into `registration_opens_at` and `registration_closes_at` when they're null,
so without it an event created with no registration window (always open)
would close a week after creation. PR A's form always sends both legacy keys,
so the defaults never applied to it.

Then the code:

- **Admin event form** edits `starts_at`, `ends_at`, `registration_opens_at`
  and `registration_closes_at` as Pacific wall-clock values and converts them
  for storage. It sends `save_admin_event_atomically` only those keys,
  `requires_application` and `publish_at`; the legacy columns keep whatever
  they held. A create-form draft saved under the old field names drops them on
  restore.
- **Archived** is no longer offered. An already-archived event shows it,
  disabled, until the admin picks another status.
- **Readers** use the new columns: the portal timeline and event page, the
  marketing `/events` pages, checkout, tickets, the receipt email, the admin
  events table and check-in header, purchase history. Dates and times are
  formatted in Pacific time. `fetchEvents` orders by `starts_at`.
- **Timeline:** an event moves from upcoming to past once `ends_at` passes
  (`starts_at` when there's no end), not at the end of its day.
- **Seed** writes `starts_at` and `ends_at` from the same Vancouver
  wall-clock times on the same relative dates, and the same registration
  windows under their new names. Legacy columns stay null on seed rows.

The legacy date columns, `applications_enabled` and the Archived status are
still in the schema and the generated types until step 3. The only code left
that names them is the `legacy event column sync` integration test, which
covers the trigger PR A's deployed code depends on.

## 3. Remove

Push once step 2's code is live.

- **Backfill once more:** `backfill_event_tickets_and_applications()` picks up
  registrations the old code wrote before step 2 deployed. Run it before
  dropping anything.
- **Policies on legacy columns:** "application questions: applicants read"
  on `event_application_questions` still checks `registration_start_time`,
  `registration_end_time` and `event_registrations`. After PR B those windows
  are stale or null, but only admins read questions today. Rewrite it on
  `registration_opens_at`, `registration_closes_at` and `event_applications`
  before dropping the columns, or the drop fails (or `cascade` silently
  removes it).
- **Code:** delete the `legacy event column sync` test in
  `ticket-reservation.integration.test.ts`, regenerate the types, and drop the
  `as Partial<EventRow>` cast in `AdminEventsTable.test.tsx`.
- **`event_status`:** archived events that have ended become `active` (keeping
  members' history), the rest `draft`. Then recreate the enum without
  `archived`.
- **Drop:**
  - `sync_legacy_event_columns`, the `legacy_event_*` helpers, and the backfill
    function;
  - `event_registrations`, `reserve_paid_event_ticket`,
    `release_paid_event_ticket_reservation`, and `event_registration_counts`;
  - the legacy date and time columns and `applications_enabled`;
  - the `application_status` enum.
- **Not null:** `check_ins.ticket_id` and
  `event_application_responses.application_id`.

## Background: the 2026-10-17 break

The first attempt, `20261015000001`–`04`, renamed `applications_enabled`,
removed `archived` from `event_status`, replaced the `application_status`
values, and rewrote the reservation and save functions. It was pushed before
any code used it, which broke the deployed code: reading
`applications_enabled`, archiving an event, submitting or declining an
application, reserving and releasing a paid ticket, and saving an event in
admin.

- The four files stay in the repo: the hosted history has them, and `db push`
  is forward-only.
- `20261015000005` restores what the deployed code needs, exactly as main had
  it. Step 1 also replaces the rows `03`–`04` backfilled.
- **To do:** `02` turned archived events into drafts without recording which,
  so re-archive them by hand.
