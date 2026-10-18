# Registration rollout

How `event_registrations` and the legacy event columns become the schema in
[schema-proposed.sql](schema-proposed.sql) and
[event-states.md](event-states.md) without breaking the deployed code.

Migrations reach the hosted database before their code is deployed, so each step's
migration has to work with the code that is live when it is pushed.

## 0. What happened on 2026-10-17

The first version of this work (`20270101000001`–`04`) renamed
`applications_enabled`, removed `archived` from `event_status`, replaced the
`application_status` values and rewrote the reservation and save functions. It
was pushed to the hosted project before any code used it, so the deployed code
stopped working against it: reading `applications_enabled`, archiving an event,
submitting or declining an application, reserving and releasing a paid ticket,
and saving an event in admin all fail.

Those four files stay in the repo because the hosted history has them, and
`db push` is forward-only. `20270101000005` puts back what the deployed code
needs, exactly as main had it. Archived events were turned into drafts, and
which ones they were is not recorded, so re-archive them by hand.

Every new migration has to sort after `20270101000010`, the newest version in
the hosted history, or `db push` refuses it as out of order.

## 1. Add (`20270101000005`–`20270101000010`)

Only adds to what main had, so the deployed code keeps working.

- `events` gains `publish_at`, `starts_at`, `ends_at`, `registration_opens_at`,
  `registration_closes_at` and `requires_application`. The
  `sync_legacy_event_columns` trigger copies each legacy write into them.
- `event_is_public(status, publish_at)` decides what members see; the events,
  mentor and sponsor read policies use it, so scheduled events stay hidden.
- `event_tickets`, `event_applications` (moved to its own enum,
  `event_application_status`, with the allowed moves enforced by a trigger),
  `check_ins.ticket_id` and `event_application_responses.application_id`. The
  rows `20270101000003`–`04` backfilled are replaced.
- `event_seat_counts`, `event_seat_counts_unfiltered` and
  `reserve_event_ticket`.
- `backfill_event_tickets_and_applications()` copies registrations across:
  attending registrations become tickets, and registrations on
  `applications_enabled` events become applications. It is safe to repeat.

The legacy tables, columns, enum values and functions are as main had them. A local
database rebuilt with `pnpm supabase:local` starts with empty ticket and
application tables, since the seed writes registrations only.

## 2. Move the code over

Its migration runs first, while step 1's code is still live:

- call `backfill_event_tickets_and_applications()` again, to pick up what the
  deployed code wrote since step 1;
- let `check_ins.event_registration_id` and
  `event_application_responses.event_registration_id` be null;
- replace `save_admin_event_atomically` with one that writes a column only
  when the payload carries its key, so the old and new admin forms both save.

Then the code reads and writes only the new tables and columns: fulfillment
calls `reserve_event_ticket`, applications insert into `event_applications`,
check-in goes by ticket, and the event form drops the Archived option. The seed
writes tickets and applications.

## 3. Remove the legacy schema

Push after step 2's code is live.

- Archived events that have ended become `active`, which keeps members'
  history; the rest become `draft`. Then recreate `event_status` without
  `archived`.
- Drop `sync_legacy_event_columns`, the `legacy_event_*` helpers and the
  backfill function; `event_registrations`, `reserve_paid_event_ticket`,
  `release_paid_event_ticket_reservation` and `event_registration_counts`; the
  legacy date, time and `applications_enabled` columns; and the
  `application_status` enum.
- Make `check_ins.ticket_id` and `event_application_responses.application_id`
  not null.
