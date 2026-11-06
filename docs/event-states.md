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

Draft events are hidden. Whether an event is upcoming or past comes from
`starts_at` and `ends_at`, not from its status, so a finished event stays
Published and members keep their history.

### Scheduling publication

The admin create/edit form has an optional **Publish Date & Time (Pacific)**
field, available only for Draft events. Choose a future date to schedule the
change from Draft to Active. Leave it empty to keep the event in Draft.
Clearing it cancels publication; manually activating an event also clears its
schedule.

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

Each pending schedule also arms a bounded health watchdog. One shared job wakes
five minutes after the expected publication run, then at five-minute intervals
for at most three notification attempts per event schedule. Publication success,
cancellation, deletion or manual status changes remove its window. Changing the
publication date starts a new window; ordinary edits and publication retries do
not reset the budget. Exhaustion removes its pending checks but does not stop
publication retries or recovery. No five-minute polling job runs while idle.

The watchdog uses `pg_net` to POST a timestamp and HMAC signature to
`/api/internal/event-publication`. This endpoint independently counts drafts
overdue by at least five minutes and reports `event.publication_overdue` through
the existing server logger to Sentry. Queued requests contain no shared secret
or event data. HTTP delivery is asynchronous; later checks inspect previous
responses. The final request remains inspectable through its recorded request
ID and `net._http_response` (subject to pg_net response retention).

Monitoring shares database availability: it cannot alert during a complete
database outage. Missed checks resume after the database returns. An unavailable
endpoint consumes the same three-attempt budget; exhausted windows remain in
the private `event_publication.watchdog` table until resolved or rescheduled.
See [watchdog setup](../supabase/README.md#publication-watchdog) before enabling
notifications in production.

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

The portal event page and checkout read the event under the viewer's RLS, so
staff reach drafts and members get a 404. Fulfillment
(`createSquarePaymentForEventTicket`) uses the service role, so it drops the
`status = active` filter only for admins and managers, and
`reserve_event_ticket` checks the role again.

## Admin: application

Only for events with `requires_application`.

`event_applications.status` (enum `event_application_status`) has exactly five
values. The database enforces the moves below:

| `status` | Meaning | Next |
| --- | --- | --- |
| `draft` | The applicant is still filling it in | `submitted`, only through `submit_event_application` |
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

Drafts belong to the applicant alone:

- Members create applications only as drafts, inside the registration window.
  `submit_event_application` submits one after checking that it is theirs, the
  window is open, and every required question has an answer (and a file answer
  names one of their uploads). It records `submitted_at`, which the review
  list sorts by.
- Answers and uploaded files can change only while the application is a
  draft. The applicant may delete their draft; nobody can delete a submitted
  one.
- Admins never see drafts: RLS hides them and their answers and files, the
  review list and its counts leave them out, and no decision can move one.
  Drafts hold no seat.

## Students: event badge

Every event card shows exactly one badge: the student's own badge if they have
one, otherwise the event's availability badge. Once an event has ended, it shows
"Checked in" or "Past" either way.

### The student's own badge

Shown once they've applied or registered.

A `draft` is not an application yet for badges: the student sees the event's
availability badge until they submit.

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
As well, "Registration closed" beats "Full" so that students can't register even if spots open up.  

## Students: teams

Only for events with `teams_enabled`. Teams form after registering: every
team action needs a ticket to the event.

- A student creates a team, which gets an invite link, or joins one with a
  teammate's link. They're on at most one team per event.
- A team holds up to `max_team_size` people; its link stops working when full.
- The owner can delete the team, which removes everyone on it. Anyone else can
  leave. The owner can't leave without deleting it.
- At `team_deadline` teams lock: nobody creates, joins, leaves or deletes, and
  admins place anyone without a team. A team admins make has no owner.
- `min_team_size` isn't enforced: admins sort out small teams at the deadline.
- Deleting an account frees the student's team spots. A team they owned passes
  to the teammate who joined first, or is deleted if nobody else is on it.
  Their ticket stays, as for any deleted account.

The server makes these changes through `create_team`, `join_team`,
`leave_team` and `delete_team`, which return why a change was refused
(`NO_TICKET`, `TEAMS_LOCKED`, `TEAM_FULL`, ...) instead of failing.

## Seats

Seats taken = tickets + accepted offers that haven't expired and have no ticket
yet. Since nobody gives a spot back, a full event only reopens when an offer
expires.

## Check-in status for multi-day events
Currently, if an event spans multiple days and requires check-in for multiple days, the badge will show 'Checked-in' from the first day they check in until the end of the event, regardless of whether they need to check in again at a later day in the event. 