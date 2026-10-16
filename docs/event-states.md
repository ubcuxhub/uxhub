# Event states

What admins and students see for an event, and where each state comes from.
Columns refer to [schema-proposed.sql](schema-proposed.sql).

Once someone registers, they stay registered: there is no cancelling or
releasing a spot.

## Admin: event

| State | Members see it? | Comes from |
| --- | --- | --- |
| Draft | No | `status = draft` |
| Scheduled | Not yet | `status = active`, `publish_at` in the future |
| Published | Yes | `status = active`, `publish_at` empty or passed |

Draft is the only way to hide an event. Whether an event is upcoming or past
comes from `starts_at` and `ends_at`, not from its status, so a finished event
stays Published and members keep their history.

## Admin: application

Only for events with `requires_application`.

`event_applications.status` has exactly four values:

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
