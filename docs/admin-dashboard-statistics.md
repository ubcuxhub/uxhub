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

The chart starts on the latest six events. Wheel input over the chart retains
normal page scrolling and browser zoom. Left/right keys pan only while the
chart surface has focus. Visible controls provide zoom, pan and reset actions. Carousel
changes preserve the chart range, and chart navigation does not change slides.
The expandable data list provides full names, dates and counts without relying
on hover. Charts do not animate or auto-rotate.

## Durable membership history and all-account majors

The additive `admin_membership_history` and `admin_major_distribution` RPCs
supply the replacement cards in the dashboard-refresh project. The current
carousel continues using the older RPCs above until its UI ticket lands.
Only admin/manager viewers can execute these aggregate readers; private tables
and trusted writer RPCs have no anonymous/authenticated privileges.

`membership_awards` stores one opaque profile UUID per academic year, the first
qualifying timestamp/month, and purchase/manual source. It has no foreign key
to profiles or purchases and retains no names, emails or tier details. Refunds,
expiry, membership removal and account deletion never subtract an award.
`membership_award_months` stores calendar-month totals. Transactional triggers
maintain it from the deduplicated ledger; uniqueness and a shared transaction
lock protect retries, concurrent manual/purchase grants and earlier imports.
`rebuild_membership_history` imports reliable fulfilled completed membership
purchases, moves awards to earlier reliable dates when appropriate, and rebuilds
the summary. Repeating it preserves manual awards and produces the same totals.
It does not reconstruct deleted purchase evidence or infer manual grant dates.

Successful purchase fulfillment commits the profile grant, fulfillment marker
and recording together through the service-only `fulfill_membership_purchase`.
Both existing admin profile-edit paths record qualifying manual assignments
through a database trigger on changes to the membership tier column. Re-saving
the same tier does not turn undated existing membership into a new grant. Incomplete purchases,
unfulfilled preorders, expired assignments and unrelated profile edits do not
record grants. Existing expiry calculation and club-term policy still apply.

Each academic year covers September 1 inclusive through May 1 exclusive in
`America/Vancouver`. May–August grants are excluded without changing checkout.
The first grant counts once in its local calendar month and academic year;
later grants or tier changes in that year cannot increase the count.

The history response contains `latestAcademicYear`, `completeFrom`, and ordered
`years` with `academicYear`, `label`, `count`, `coverage` and eight September–April
`months`. `p_now` supplies the report cutoff; optional first/last year parameters
request up to 201 years, including absent or future periods. Summer defaults to
the most recently completed year. Coverage is explicit:

| Coverage | Meaning / count |
| --- | --- |
| `complete` | Recording covers the entire elapsed period; exact count as of the report time, including genuine zero. Current years can include future months. |
| `partial` | Reliable awards or part of the period are recorded, but earlier manual history is unknown; year count is a lower bound, possibly zero; monthly attribution is provisional and may move with earlier evidence. |
| `unavailable` | No reliable awards or recording coverage; count is null. |
| `future` | Period has not begun at the report time; count is null even if a trusted import has a later timestamp. |

The migration stores its actual recording start in
`membership_history_coverage`. It backfills only `purchases.fulfilled_at` for
completed membership purchases. Existing profiles have no reliable manual-grant
date: their creation/update dates are never used. All earlier periods therefore
remain partial/unavailable, and the deployment month/year remain partial when
recording began after their start. All observed months in that academic year
remain partial: earlier undated grants can change first-month attribution even
after recording begins. Complete monthly attribution starts with the first
fully recorded academic year. A failed helper query throws; callers must
show failure separately from unavailable history. There are no snapshots.

For example, two people first granted in November 2026 add two to November and
2026–2027; granting either person another tier in December adds zero. A reliable
October fulfillment imported later moves that person's contribution from
November to October. On a November deployment, pre-deployment uncertainty still
marks that academic year partial. Previous-calendar-month additions are read
from the corresponding month; null/partial must not become an exact “+0”.

Major distribution returns `totalAccounts` and `{major,count}` segments across
**all non-deleted profiles**, regardless of membership. Whitespace-only/missing
majors join the `Unknown` segment, which remains in the denominator. Every
account contributes once; an all-Unknown distribution is valid. A zero-account
population returns zero and an empty segment array. No selected-major filter
changes this population.

Local fixture reconciliation, after normal pruning, resets awards only for the
named fixture profile IDs and reimports their dated fulfilled purchases. Undated
fixture memberships do not invent award dates. `--no-prune` preserves existing
awards; production seeding never invokes this reset. Test cleanup likewise clears
only its tagged people. Both use ledger mutations so summaries stay consistent;
normal account deletion never takes this fixture-only maintenance path.

## Deployment and verification

The production build applies additive migrations before deploying the app. The
history migration preserves the existing analytics RPCs and their consumers.
The ledger, summary and coverage tables are registered in `TABLES`.

Database authorization and counting behavior are covered by the local
integration and RLS suites. Component tests cover slide selection, chart range
preservation, wheel and keyboard handling, empty states and failed summaries.
Manual review should check responsive chart rendering, pointer tooltips,
trackpad behavior and keyboard focus; repository instructions prohibit browser
automation unless explicitly requested.
