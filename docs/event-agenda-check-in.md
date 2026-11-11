# Event agenda and check-in

Proposal: merge check-in sessions into agenda items, so an event has one list
of what happens and when, and an admin marks the items that need check-in.

Status: draft for discussion. Touches the Admin epic (event builder) and Event
tickets (check-in).

## Problem

Right now an event stores its time in three places, and none of them point to
each other:

| Where | What it holds | Used by |
| --- | --- | --- |
| `events.starts_at` / `ends_at` | one start and end for the whole event | listing, sorting, upcoming vs past |
| `check_in_sessions` | name, start, end | the check-in scanner |
| `event_agenda_days` + `event_agenda_items` | days, then timed items | the schedule on the event page |

So an admin types the same times twice. For example, the agenda says
"Check-in and welcome, 8:00–9:00 AM", and a check-in session repeats it. The
builder shows this as two sections (Date and location, and Schedule) that look
like duplicates. Nothing stops the two from disagreeing: an agenda day can fall
outside the event's dates, and a session can fall outside both.

## Current schema

```sql
events (
  id, …,
  starts_at timestamptz,
  ends_at timestamptz,
  location_type, location_building, location_room, location_address, …,
  agenda jsonb,             -- legacy, still read by the marketing page
  agenda_enabled boolean    -- show the schedule on the event page
)

check_in_sessions (
  id,
  event_id   → events on delete cascade,
  name text not null,
  start_time timestamptz,   -- nullable
  end_time   timestamptz    -- nullable
)

check_ins (
  id,
  ticket_id,
  check_in_session_id → check_in_sessions on delete cascade,
  checked_in_at timestamptz
  -- unique (ticket_id, check_in_session_id)
)

event_agenda_days (
  id,
  event_id → events on delete cascade,
  date date not null,
  title text,               -- e.g. "Day 1"
  unique (event_id, date)
)

event_agenda_items (
  id,
  event_agenda_day_id → event_agenda_days on delete cascade,
  title text not null,
  start_time time not null,
  end_time   time not null,
  building text,            -- null: use the event's building
  room text                 -- null: use the event's room
)
```

## Proposed schema

Check-in becomes a flag on an agenda item. `check_in_sessions` goes away.

```sql
events (
  id, …,
  starts_at timestamptz,    -- now derived: earliest item start (trigger)
  ends_at timestamptz,      -- now derived: latest item end (trigger)
  location_type, location_building, location_room, location_address, …,
  agenda_enabled boolean    -- display only: show the schedule on the event page
  -- agenda jsonb: dropped once the marketing page reads the tables
)

event_agenda_days (          -- unchanged
  id, event_id, date, title,
  unique (event_id, date)
)

event_agenda_items (
  id, event_agenda_day_id, title, start_time, end_time, building, room,
  requires_check_in boolean not null default false   -- new
)

check_ins (
  id,
  ticket_id,
  agenda_item_id → event_agenda_items,   -- replaces check_in_session_id
  checked_in_at timestamptz
  -- unique (ticket_id, agenda_item_id)
)
```

## Rules

1. **Every event has at least one check-in item.** Checked before publishing.
   A simple event is one day with one item, e.g. "Talk, 6–8 PM", check-in on.
2. **An item with check-ins is locked.** It can't be deleted, and its check-in
   toggle can't be turned off. Its title and times can still change. This is
   the rule `save_event_check_in_sessions` enforces today, moved to items.
3. **The time window doesn't block scanning.** The scanner defaults to today's
   current or next check-in item, but a late arrival can still be checked in.
4. **The schedule toggle only controls display.** A simple event has an item
   but usually doesn't need a one-row schedule card on its page.
5. **Students see which items need check-in.** A "Check-in" badge on the row
   tells them when to have their QR code ready.

## What this gets us

- One list to edit. The builder's Date and location and Schedule sections
  merge into days, each with its items.
- Check-in times can't disagree with the agenda.
- Tracking meals or a capped workshop is just another item with the toggle on.
  No new schema.

## Why not check in for every item?

Check-in means "this person showed up". Scanning at every talk needs a
volunteer in every room and makes attendees queue again and again. The toggle
keeps check-in to the few items that need it, usually one per day.

## Migration

The production builder writes `check_in_sessions`, and a rollback doesn't undo
a migration, so this ships in steps:

1. Add `event_agenda_items.requires_check_in` and a nullable
   `check_ins.agenda_item_id`.
2. Backfill: turn each `check_in_sessions` row into a check-in item (creating
   its agenda day if needed) and point its `check_ins` at that item. A session
   with no times needs a fallback, e.g. the event's `starts_at` / `ends_at`.
3. Point the builder, the scanner and the event page at agenda items.
4. In a later migration, make `agenda_item_id` not null, then drop
   `check_ins.check_in_session_id`, `check_in_sessions`, and `events.agenda`.

## Open questions

- Should `starts_at` / `ends_at` be derived from items (proposed), or stay
  editable with items checked against them?
- A session with null times: use the event's times, or block the backfill
  until an admin fills them in?
- Do we need hidden items (on the check-in list, but not on the public
  schedule)?
