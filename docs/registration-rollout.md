# Registration rollout

Moves `event_registrations` and the legacy event columns to the schema in
[schema-proposed.sql](schema-proposed.sql) and
[event-states.md](event-states.md) without breaking the deployed code.

Migrations reach the hosted database before their code deploys, so each one
must work with the code that is live when it is pushed.

| Step | Change | Status |
| --- | --- | --- |
| [1. Add](#1-add) | New schema beside the old | Done (`20261015000005`–`10`) |
| [2. Move the code](#2-move-the-code) | Code uses only the new schema | Next |
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

The migration runs first, while step 1's code is still live. It:

- re-runs `backfill_event_tickets_and_applications()` to pick up writes since
  step 1;
- makes `check_ins.event_registration_id` and
  `event_application_responses.event_registration_id` nullable;
- replaces `save_admin_event_atomically` with one that writes a column only
  when the payload has its key, so the old and new admin forms both save.

Then the code moves to the new schema:

- fulfillment calls `reserve_event_ticket`;
- applications insert into `event_applications`;
- check-in goes by ticket;
- the event form drops the Archived option;
- the seed writes tickets and applications.

## 3. Remove

Push once step 2's code is live.

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
