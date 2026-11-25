# Admin dashboard statistics

Statistics contains independently streamed Area of Study and Club Members cards,
using `admin_major_distribution`, `admin_membership_history` and the independent
`admin_recent_membership_additions` tag aggregate. Each card has its own
loading/error surface; a rolling-tag failure hides the tag. All readers
explicitly require admin/manager access and return aggregate JSON,
without PostgREST row-limit truncation. Private history has no browser access.

## Presentation

Area of Study includes all non-deleted accounts, including non-members and
Unknown. It starts with the full distribution, no selected major, the all-account
total and the exact **Select** button. Selecting emphasizes an existing segment
and shows its count/share/label without filtering other segments or the denominator.
Narrow cards hide the visual donut following Figma and accepted D-14; the full
textual distribution remains accessible. All-Unknown is valid data; zero accounts
and failed queries have separate text-only states.

Club Members defaults to Monthly and the latest reporting academic year from the
server; summer uses the most recently completed year. Monthly starts at September
with the scrollbar at the left, including after year changes. Its headline and
single subtitle show the selected year's total and label. Yearly keeps the latest
reporting year's total and shows one data-derived range subtitle (currently
2025–2027). Monthly bars show September–April first-grant additions. Its year submenu
lists academic years in descending order, with the current reporting year first.

The trend icon and “+N past 30 days” pill use unique first-grant members in the
rolling past 30 days, not a calendar-month bucket. The window includes award
timestamps from the server cutoff minus exactly 720 hours through that cutoff,
including both boundaries. Only Yearly/current-year Monthly show a numeric pill;
historical Monthly, unavailable history and failed rolling queries hide it.
Monthly/yearly bar calculations remain unchanged. Summer still uses the same
award ledger rules: May windows can include late-April awards; fully summer
windows have no qualifying additions. Missing counts never become zero.

One accessible info control immediately to the right of the Club Members heading says exactly “Membership data
collection began in the 2026-2027 academic year”. Partial-coverage annotations and
asterisks are suppressed across this card's bars, details and accessible labels;
coverage metadata and database counts remain unchanged. Data unavailable, Not yet
reported and known zero retain separate displays. Arrows step the scroll viewport
and disable at its ends. Drag the native thumb or focus/tap/hover a bar for counts.
Up to seven bars fit when space and readable labels allow. Page scrolling and
browser zoom remain native; charts do not animate. Donut segment clicks and the
Area of Study dropdown update the same count, share and selected highlight.
The donut and metrics form a centered group within their content column. A
16rem maximum wrapper reserves text space beside the non-shrinking donut,
keeping it horizontally stationary when the selected label/count/share changes.

The old membership-tier/event carousel and feature zoom/pan code are removed.
The analytics RPCs drafted for it were never deployed and are not part of the
schema. Current data regressions cover the supported aggregates and
upcoming-event helpers.

## Durable membership history and all-account majors

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
A purchase without a Square customer ID keeps the profile's existing one.
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
marks that academic year partial. `admin_recent_membership_additions(p_now)`
reads distinct people from award timestamps in `[p_now - 720 hours, p_now]` using
an award-time index. It authorizes the requesting admin/manager and returns only
count/coverage; private award rows never reach the client. `complete` means the
whole rolling window follows the recording start; before that, observed counts
remain `partial`, with wholly unknown history returning null/`unavailable`.
The server loads this aggregate independently so a failed rolling query hides
only the pill. The obsolete previous-calendar-month helper and tests are removed.

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

The additive history migration precedes this UI release; production code
calls none of the RPCs it adds until the release ships. Tables and generated
types are unchanged by the presentation ticket. Database authorization/counting remain
covered by integration and RLS suites. UI regressions cover selection, reporting
periods, honest coverage, independent failure/loading and native interaction.

Human review covers `/admin` at 1440px with both sidebar modes, 768px and 390px,
intermediate widths/200% zoom, both themes/densities and reduced motion. Check
normal, selected, all-Unknown, empty/error and unavailable/partial history states;
drag the scrollbar, navigate period menus with keyboard and tap/focus values.
Agents do not sign in or enter credentials.
