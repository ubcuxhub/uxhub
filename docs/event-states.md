# Event states

What admins and students see for an event, and where each state comes from.
Columns refer to [schema-proposed.sql](schema-proposed.sql).

Once someone registers, they stay registered: there is no cancelling or
releasing a spot, and no withdrawn state.

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

| State | Meaning | Next |
| --- | --- | --- |
| Submitted | Waiting for review | Accepted, Waitlisted, Rejected |
| Waitlisted | Not yet; may be accepted later | Accepted, Rejected |
| Accepted | Offered a spot until `offer_expires_at` | Registered, Offer expired, Rejected |
| Rejected | Final | |
| Registered | Accepted and has a ticket | |
| Offer expired | Accepted, deadline passed, no ticket | Accepted again with a new deadline |

Submitted, Waitlisted, Accepted and Rejected are stored in `status`. Registered
and Offer expired are worked out from the ticket and the deadline.

- Every accepted application has a deadline; the database rejects one without.
- Waitlisted applicants are only moved to Accepted by an admin, never
  automatically.
- Re-offering an expired spot keeps `status = accepted` and sets a new
  `offer_expires_at`.
- Taking back an offer before the person registers changes it to Rejected.

## Students: event badge

Each event shows one badge. Check these in order and use the first that applies.

1. **Event has ended:** "Checked in" if they attended, otherwise "Past".
2. **Has a ticket:** "Checked in" once scanned, otherwise "Going".
3. **Has an application:**
   - Submitted → "Under review"
   - Waitlisted → "Waitlisted"
   - Accepted → "Register by Oct 20" (the offer deadline)
   - Offer expired → "Offer expired"
   - Rejected → "Not selected"
4. **Otherwise, the event's availability:**
   - Before `registration_opens_at` → "Opens Oct 12"
   - After `registration_closes_at` → "Registration closed"
   - No seats left → "Full"
   - Otherwise → "Registration open"

| Color | Meaning | Badges |
| --- | --- | --- |
| Green | You're in, or you can act | Registration open, Going, Checked in |
| Amber | Waiting on the club | Under review, Waitlisted |
| Blue | Waiting on you | Register by Oct 20 |
| Gray | Nothing to do | Opens Oct 12, Full, Registration closed, Past, Offer expired, Not selected |

## Seats

Seats taken = tickets + accepted offers that haven't expired and have no ticket
yet. Since nobody gives a spot back, a full event only reopens when an offer
expires.
