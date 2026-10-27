# Event states

What admins and students see for an event, and where each state comes from.
Columns refer to [schema-proposed.sql](schema-proposed.sql).

Once someone registers, they stay registered: there is no cancelling or
releasing a spot.

## Admin: event

| State | Members see it? | Comes from |
| --- | --- | --- |
| Draft | No | `status = draft` |
| Scheduled | No | `status = draft`, `publish_at` set |
| Published | Yes | `status = active` |

Draft and Archived events are hidden. Whether an event is upcoming or past
comes from `starts_at` and `ends_at`, not from its status, so a finished event
stays Published and members keep their history.

### Scheduling publication

The admin create/edit form has an optional **Publish Date & Time (Pacific)**
field, available only for Draft events. Choose a future date to schedule the
change from Draft to Active. Leave it empty to keep the event in Draft.
Clearing it cancels publication; manually activating or archiving an event also
clears its schedule.

Saving, changing, clearing, deleting, or manually publishing a scheduled draft
recalculates one shared database job for the earliest pending `publish_at`.
It runs at that minute (rounded up for timestamps containing seconds), activates
all due drafts, clears their dates, and schedules the next run. It runs even
when nobody has the app open. Concurrent edits and publication are serialized
before acquiring event row locks.

When no schedules remain, both the publication job and recovery job are removed.
While schedules exist, an hourly recovery check at minute 17 catches missed
runs after database downtime. Failed updates leave the events unchanged and
schedule a retry every minute until a successful run restores the normal
schedule. Run history for these jobs is pruned to seven days during scheduling;
there is no separate cleanup timer. Cron has no year field, so the timestamp
predicate prevents an event scheduled more than a year away from publishing
early if its calendar schedule fires in an earlier year.

Public visibility depends only on Active status. The admin list reflects the
stored status when refreshed. Public marketing pages retain their existing
five-minute cache revalidation.

### Drafts for admins

A draft is visible only to admins and managers, and they can use it the way a
member would. This is how we test an event, such as a QR check-in trial, without
a separate "test" state.

- **Who sees it:** RLS already returns drafts only to `is_admin()`, which covers
  admins and managers. Everyone else gets a 404, as if the event didn't exist.
- **Portal event page and checkout:** admins and managers can open a draft's
  `/portal/events/[slug]` page, register through its checkout, and get a ticket.
  The page shows a "Draft: only admins can see this" banner.
- **Not listed anywhere:** the portal timeline and the public `/events` pages
  stay active-only. Share a draft by its direct portal link. The public
  `/events/[slug]` page is cached and uses the anon client, so it never shows
  a draft.
- **Enforced on the server:** fulfillment reads events with the service-role
  client, which bypasses RLS. It has to check the buyer's role itself before it
  sells a draft ticket. `reserve_event_ticket` does this: it looks up the
  buyer's role and lets only admins and managers register for a draft or
  scheduled event.

Preview deploys share the production database (the free plan has no branching),
so registrations and check-ins made on a test draft are real production rows.
Keep the event in Draft afterwards, or delete it along with its registrations.

**Not built yet:** today the portal event page and fulfillment
(`createSquarePaymentForEventTicket`) both require `status = active`, even for
admins. They move to `reserve_event_ticket` with the rest of the code
(see [registration-rollout.md](registration-rollout.md)).

## Admin: application

Only for events with `requires_application`.

`event_applications.status` (enum `event_application_status`) has exactly four
values. The database enforces the moves below:

| `status` | Meaning | Next |
| --- | --- | --- |
| `submitted` | Waiting for review | `accepted`, `waitlisted`, `rejected` |
| `waitlisted` | Not yet; may be accepted later | `accepted`, `rejected` |
| `accepted` | Offered a spot until `offer_expires_at` | `rejected` |
| `rejected` | Final | |

An `accepted` application is shown to admins as one of three states. These are
not `status` values; they're worked out from the deadline and the ticket:

| Shown as | When |
| --- | --- |
| Accepted | Before `offer_expires_at`, no ticket yet |
| Registered | Has a ticket |
| Offer expired | `offer_expires_at` has passed, no ticket |

- Every accepted application has a deadline; the database rejects one without.
- Waitlisted applicants are only moved to Accepted by an admin, never
  automatically.
- Re-offering an expired spot keeps `status = accepted` and sets a new
  `offer_expires_at`.
- Taking back an offer before the person registers changes it to Rejected.

## Students: event badge

Every event card shows exactly one badge: the student's own badge if they have
one, otherwise the event's availability badge. Once an event has ended, it shows
"Checked in" or "Past" either way.

### The student's own badge

Shown once they've applied or registered.

| Badge | Shown when |
| --- | --- |
| Under review | Their application is `submitted` |
| Waitlisted | Their application is `waitlisted` |
| Register by Oct 20 | Accepted, before the offer deadline, no ticket yet |
| Offer expired | Accepted, but the deadline passed without registering |
| Not selected | Their application is `rejected` |
| Going | They have a ticket |
| Checked in | Their ticket has been scanned |

### Event availability badge

Shown when they haven't applied or registered.

| Badge | Shown when |
| --- | --- |
| Opens Oct 12 | Before `registration_opens_at` |
| Registration open | Registration is open and seats are left |
| Full | No seats left; can reopen if an offer expires |
| Registration closed | After `registration_closes_at` |
| Past | After `ends_at` |

### When more than one applies

Use the first rule that matches:

1. The event has ended: "Checked in" if they attended, otherwise "Past".
2. They have a ticket: "Checked in" or "Going".
3. They have an application: its badge.
4. Otherwise: the availability badge.

So a student who's going to an event that has since filled up still sees
"Going", not "Full".

## Seats

Seats taken = tickets + accepted offers that haven't expired and have no ticket
yet. Since nobody gives a spot back, a full event only reopens when an offer
expires.
