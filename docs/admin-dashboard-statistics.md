# Admin dashboard statistics

The Statistics panel has two manually selected slides. Both summaries load in
parallel on the server, through `admin_membership_analytics` and
`admin_event_analytics`. These functions explicitly require `is_admin()`
(including managers) and return only aggregated data. Membership reads retain
the caller's RLS permissions. Event aggregation runs as owner after the explicit
admin check to avoid repeating the same authorization checks for every source
row; its search path is fixed and anonymous execution is revoked. Their JSON
envelopes avoid PostgREST's response row limit.

## Members

Active members have a membership tier, have not deleted their account, and
have not passed either their individual expiry or the club-wide term end. A
missing expiry places no ceiling on that membership. Active tiers appear in
the legend even at zero; inactive tiers appear while they still have active
members.

The footer counts distinct buyers of completed membership purchases fulfilled
within the last 720 hours, including both endpoints and excluding future
fulfillment timestamps. Renewals count, but repeated purchases by one user do
not increase the buyer count. Purchases retained after account deletion remain
part of this historical metric. This is a purchase count, not net member growth;
there are no snapshots or scheduled jobs.

## Events

Bars represent published `active` events with a start timestamp, ordered by
start time and ID. Drafts, archived events and scheduled unpublished events are
excluded. Past and upcoming events are both included. The two bars represent
confirmed registrations (`attending = true`) and distinct registered people
with at least one non-null check-in timestamp in a session belonging to that
event. Multiple check-in sessions never multiply a person's attendance.

The current event is the earliest-starting published event that has not ended,
matching the left-hand preview. Events remain selected until their end timestamp;
without one, the start timestamp is the cutoff. Selection advances at the exact
cutoff when the dashboard next loads.
The yearly total counts distinct checked-in people across events starting from
September 1 (inclusive) through May 1 (exclusive) in `America/Vancouver`. From
May through August the most recently completed school year remains selected.
Retained records belonging to deleted accounts remain in these historical
totals.

The chart starts on the latest six events. Wheel input over the chart changes
the visible event count around the pointer; page scrolling resumes when that
zoom direction reaches its limit. Ctrl/Meta-wheel remains available for browser
zoom. Left/right keys pan only while the chart surface has focus.
Visible controls provide equivalent zoom, pan and reset actions. Carousel
changes preserve the chart range, and chart navigation does not change slides.
The expandable data list provides full names, dates and counts without relying
on hover. Charts do not animate or auto-rotate.

## Deployment and verification

Apply migrations through `20261027230342` to the hosted project before merging
or deploying this dashboard. Existing tables and checkout behavior are
unchanged. No new table entries are needed in `TABLES`.

Database authorization and counting behavior are covered by the local
integration and RLS suites. Component tests cover slide selection, chart range
preservation, wheel and keyboard handling, empty states and failed summaries.
Manual review should check responsive chart rendering, pointer tooltips,
trackpad behavior and keyboard focus; repository instructions prohibit browser
automation unless explicitly requested.
