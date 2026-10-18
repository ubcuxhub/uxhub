# Registration rollout

How `event_registrations` and the legacy event columns become the schema in
[schema-proposed.sql](schema-proposed.sql) and
[event-states.md](event-states.md) without breaking the deployed code.

Migrations reach the hosted database before their code is deployed, so each step's
migration has to work with the code that is live when it is pushed.

## 1. Add (done, `20261018120000`–`20261018120400`)

Only adds, so the deployed code keeps working unchanged.

- `events` gains `publish_at`, `starts_at`, `ends_at`, `registration_opens_at`,
  `registration_closes_at` and `requires_application`. The
  `sync_legacy_event_columns` trigger copies each legacy write into them.
- `event_is_public(status, publish_at)` decides what members see; the events,
  mentor and sponsor read policies use it, so scheduled events stay hidden.
- `event_tickets`, `event_applications` (enum `event_application_status`, with
  the allowed moves enforced by a trigger), `check_ins.ticket_id` and
  `event_application_responses.application_id`.
- `event_seat_counts`, `event_seat_counts_unfiltered` and
  `reserve_event_ticket`.
- `backfill_event_tickets_and_applications()` copies registrations across:
  attending registrations become tickets, and registrations on
  `applications_enabled` events become applications. It is safe to repeat.

The legacy tables, columns, enum values and functions are untouched. A local
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
