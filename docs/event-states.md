# Event states

What admins and students see for an event, and where each state comes from.
Columns refer to [schema-proposed.sql](schema-proposed.sql).

Once someone registers, they stay registered: there is no cancelling or
releasing a spot. The club can cancel a whole event (below), which keeps
every registration.

## Admin: event

| State | Members see it? | Comes from |
| --- | --- | --- |
| Draft | No | `status = draft` |
| Scheduled | No | `status = draft`, `publish_at` set |
| Published | Yes | `status = active` |
| Canceled | Yes, marked canceled | `status = active`, `canceled_at` set |

Draft events are hidden. Whether an event is upcoming or past comes from
`starts_at` and `ends_at`, not from its status, so a finished event stays
Published and members keep their history.

### Unpublishing

Going back from Active to Draft hides the event from members, since RLS
returns drafts to staff only: a member with a ticket would get a 404 and lose
their QR code. So the database refuses it while any member is registered,
through every write path (the drawer's quick edit, the builder's Revert to
draft, a direct update, the service role): one trigger,
`guard_event_unpublish`, counts `event_member_commitments` (tickets, held
offers and payments in flight of non-staff, non-deleted accounts) and raises
"N people are registered. Cancel the event instead." with the hint
`EVENT_SETTINGS_CONFLICT`. Staff test tickets don't count. Cancel the event
instead.

When nobody is registered, the drawer and the builder still confirm first
(`EventUnpublishDialog`): the dialog counts members' draft, submitted and
waitlisted applications, which lose access until the event is published
again (`event_lifecycle_counts`).

### Canceled events

Cancel is for an event that won't happen. It's a one-way flag on a published
event, not a status: **Cancel event** in the drawer (`cancel_admin_event`,
staff only, through `cancelEventAction`) works only on an active event that
hasn't ended and isn't canceled, and sets `canceled_at` and the optional
`cancellation_note`. It can't be undone. A refusal carries the hint
`EVENT_CANCEL_REFUSED`.

Nothing is rewritten: tickets, purchases, applications, teams and check-ins
stay, and nobody is emailed. Refunds are manual: staff refund each paid ticket
in Square, and the cancel dialog says how many paid tickets (completed,
not fully refunded) there are.

After a cancel:

- **Registration** stops: checkout and reservation refuse it with
  `EVENT_CANCELED` (`event_ticket_eligibility`).
- **Applications** stop: `submit_event_application` returns
  `NOT_ACCEPTING_APPLICATIONS`.
- **Teams** lock: `create_team`, `join_team`, `leave_team`, `delete_team` and
  `rename_team` return `TEAMS_LOCKED` (`team_change_blocked`).
- **Check-in** is refused: a trigger on `check_ins` raises `EVENT_CANCELED`,
  and the scanner and lookup show "This event is canceled"
  (`event_canceled`).
- **The event is read-only**, like an ended one: the builder and the drawer
  can't change it (`zz_event_canceled_lock` on events, the child-table lock,
  and the builder save refuse with `EVENT_HISTORY_LOCKED`), and it can't go
  back to Draft. Links and resources stay editable
  (`save_past_event_resources`). The service role is no exception, so
  `pnpm seed` fails on a seed event you canceled locally; reset with
  `pnpm supabase:local`.
- **Members still see it.** It stays Active, so RLS keeps showing it to ticket
  holders and on the public pages. The portal event page, the portal
  timeline, `/events` and `/events/[slug]` show a "Canceled" badge and the
  note until the event ends, then treat it as any past event. The ticket's QR
  code is hidden, and the team card goes.

### Scheduling publication

The admin create/edit form has an optional **Publish Date & Time (Pacific)**
field, available only for Draft events. Choose a future date to schedule the
change from Draft to Active. Leave it empty to keep the event in Draft.
Clearing it cancels publication; manually activating an event also clears its
schedule.

Saving, changing, clearing, deleting, or manually publishing a scheduled draft
recalculates one shared database job for the earliest pending `publish_at`.
It runs at that minute (rounded up for timestamps containing seconds), activates
the due drafts one at a time (earliest date first), clears their dates, and
schedules the next run. It runs even when nobody has the app open. Concurrent
edits and publication are serialized before acquiring event row locks.

Each draft publishes or fails on its own, so one unready draft cannot hold the
others back. That includes the application-questions check, which otherwise
waits until commit: the publisher runs it at each draft's own update. A draft
that fails stays a draft with its date, and the reason decides when it is
tried again:

- A transient failure (a lock timeout, a serialization failure or deadlock,
  a cancelled statement, or a resource limit) is retried the next minute.
- Any other failure, such as an application event with no valid question,
  marks the draft **blocked** at that date. A blocked draft no longer sets the
  next minute run; the hourly recovery run tries it again until it publishes.
  Fixing the event isn't enough to publish it sooner: change its publish date
  (which clears the block) or publish it by hand.

Removing the last valid application question from a scheduled or active event
that requires an application is refused when the change commits, so a save that
replaces every question still works. The draft would otherwise pass its checks
when scheduled and fail only at publication.

Blocked drafts are reported to Sentry by the watchdog below. If the run as a
whole fails (outside any one draft), nothing changes and a retry every minute
is scheduled until a run succeeds.

When no schedules remain, both the publication job and recovery job are removed.
While schedules exist, an hourly recovery check at minute 17 catches missed
runs after database downtime and retries blocked drafts. Run history for these
jobs is pruned to seven days during scheduling;
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
`/api/internal/event-publication`. This endpoint reads
`event_publication_health()`: the drafts overdue by at least five minutes and
the blocked drafts. When either exists it reports `event.publication_overdue`
(`count`, `blocked`, the blocked `eventIds`, and `before`) through the existing
server logger to Sentry. Queued requests contain no shared secret
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

A draft is visible only to admins and managers, who can preview it before it is
published.

- **Who sees it:** RLS already returns drafts only to `is_admin()`, which covers
  admins and managers. Everyone else gets a 404, as if the event didn't exist.
- **Portal event page:** admins and managers can open a draft's
  `/portal/events/[slug]` page, even while `FLAGS.studentEvents` is off. It
  shows a "This is a draft event" banner and the saved unfinished sections, and
  replaces the registration panel with staff test registration
  (`DraftTestRegistration`): on a free draft, a warning that it creates a real
  registration and a **Test registration (UX Hub execs only)** button that opens
  checkout; on a paid draft, a disabled "Paid drafts can’t be test-registered"
  button and no way to pay. Once they hold a ticket, the ordinary panel shows
  it. Checkout is behind `FLAGS.studentEvents`, so while the flag is off the
  page keeps the disabled "Registration unavailable in draft preview" button
  (see "Unified saved drafts and staff previews").
- **Portal timeline:** `/portal/events` lists drafts to admins and managers
  only (`portalEventStatuses`), each with a "Draft event" badge in place of the
  state badge, under a note that only admins and managers see drafts. Search
  and the past-events switch treat a draft like any other event. A draft
  without a start date isn't listed, since the timeline groups by date; open it
  from the admin drawer. Members' list stays active-only, by the query's filter
  and by RLS. Unlike the event page, the timeline stays behind
  `FLAGS.studentEvents`.
- **Not on the public site:** the public `/events` pages stay active-only. The
  public `/events/[slug]` page is cached and uses the anon client, so it never
  shows a draft; staff preview one at `/events/<slug>?preview=draft`.
- **Free drafts only:** staff test registration is for free events. On a
  draft or scheduled event, `event_ticket_eligibility` lets only admins and
  managers register, and only when the event is free (regular and member
  price 0) and the amount is $0. Anything else is `EVENT_NOT_ACTIVE`, so a
  paid draft never gets a purchase or a card hold. The checkout dialog shows
  the same warning and labels its button **Test registration (UX Hub execs only)**.
- **Enforced on the server:** fulfillment reads events with the service-role
  client, which bypasses RLS. It has to check the buyer's role itself before it
  sells a draft ticket. `initialize_event_checkout` and `reserve_event_ticket`
  both do, through `event_ticket_eligibility`.

Preview deploys share the production database (the free plan has no branching),
so registrations and check-ins made on a test draft are real production rows.
Keep the event in Draft afterwards, or delete it: a staff member's $0 test
purchase on a draft is not a live purchase, so a draft with only staff test
registrations deletes, taking its tickets and dead purchases with it.

The portal event page and checkout read the event under the viewer's RLS, so
staff reach drafts and members get a 404. Fulfillment
(`checkoutEventTicket`) uses the service role, so it drops the
`status = active` filter only for admins and managers, and the database checks
the role again.

### Live purchases

One rule decides whether a purchase still matters (`purchase_is_live`,
`event_has_live_purchases`). A purchase is **live** when it is:

- `pending` or `authorized`: Square may still capture it;
- `completed` with `refunded_cents < amount_cents`: money is still held;
- `completed` for $0: a free registration, except a staff member's (admin or
  manager) test registration on an event that is still a draft.

Everything else is **dead**: `failed` and `canceled` attempts, fully refunded
purchases, and staff $0 tests on a draft. Square owns `purchases.status`, so a
refund is recorded in `refunded_cents`/`refunded_at`, never as a status.

Live purchases lock pricing (`admin_event_pricing_locked`) and the
registration mode (`guard_event_registration_settings`), alongside tickets and
held offers; a canceled checkout attempt locks nothing. They also protect an
event from deletion.

**Deleting an event** (`delete_event_atomically`) works when no member is
affected: `event_member_commitments` counts non-staff, non-deleted accounts
with a ticket, a held offer (accepted, unexpired, no ticket yet) or a pending
or authorized purchase, and all three must be zero, with no live purchase. The
delete then removes the event's dead purchases (`purchases.event_id` is
`on delete restrict`) and the event; tickets, check-ins, teams and
applications cascade. A refusal carries the hint `EVENT_DELETE_PROTECTED`.
The delete dialog names what goes with the event (`fetchEventHistoryInfo`,
read with the service role so drafts count): the applications and drafts with
their answers and uploaded files, the reviewer notes, the registrations and
the teams. Applicants aren't notified.

**Checkout checks before it holds a card.** `initialize_event_checkout` runs
`event_ticket_eligibility` (status, cancellation, window, offer and seats) and
the one-ticket check before it inserts a purchase, so a sold-out, closed,
expired-offer or canceled attempt leaves no purchase and never reaches Square.
Two buyers racing for the last seat can still both be authorized; the loser's
hold is voided at reservation, as before.

`events.canceled_at` (with `cancellation_note`) marks a canceled event. Cancel
is a flag on an active event, not a status value; checkout and reservation
refuse it with `EVENT_CANCELED`. `cancel_admin_event` sets it (see
"Canceled events").

`remove_event_ticket` deletes one ticket and frees its holder's team spot on
that event as account deletion does: a team they owned passes to the teammate
who joined first, or is deleted if nobody else is on it.

### Refunds

Refunds are issued in Square, never in the app. The webhook takes
`refund.created` and `refund.updated` (and a `payment.updated` that lists
refunds), fetches the payment and each of its refunds, and passes the total of
the `COMPLETED` ones, capped at Square's `refundedMoney`, to
`apply_event_purchase_refund`. It runs under the event lock, records
`refunded_cents`/`refunded_at`, and never lowers the amount, so duplicate and
out-of-order deliveries change nothing. `purchases.status` stays `completed`.

- **Full refund, no check-in:** the ticket goes (`remove_event_ticket`), which
  frees the seat and the team spot. The purchase is dead.
- **Full refund after check-in:** the ticket and its check-ins stay, and the
  app logs `payment.refund_after_check_in` at `warn` for someone to review.
- **Partial refund:** only the amount is recorded; the ticket stays and the
  purchase is still live.
- **Pending refund:** nothing is recorded until it completes.
- **Membership:** the amount is recorded and the app warns
  (`payment.membership_refunded`); the membership is not revoked.
- **Refund before fulfillment** (the capture was confirmed late): fulfillment
  skips a fully refunded purchase, and `guard_refunded_purchase_ticket`
  refuses its ticket, so no ticket is ever issued for it.

Purchase history shows "Refunded" or "Partially refunded" from the amount.

## Admin: application

Only for events with `requires_application`.

`event_applications.status` (enum `event_application_status`) has exactly five
values. Once decisions are released ([below](#decision-release)) the database
enforces the moves below; before release any decision can change to any other
among `submitted`, `waitlisted`, `accepted` and `rejected`. An offer someone
has registered on never changes.

| `status` | Meaning | Next, after release |
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

Admins decide through `decide_event_application` (service role, from
`updateApplicationDecisionAction`), which locks the event row as reservation
does and returns why it refused instead of failing:

- **Capacity.** An accept that would take a seat (the applicant has no ticket
  and no unexpired offer) counts seats as [Seats](#seats) does. When none is
  left it returns `OVER_CAPACITY` with the tickets, held offers and capacity;
  the review page then asks "Accept anyway", which passes
  `p_allow_over_capacity` and is logged as `application.accepted_over_capacity`.
  Two accepts for the last seat serialize on the lock, so only one takes it.
- **Deadline.** `offer_expires_at` must be after now and after the release
  (`DEADLINE_TOO_EARLY`). The review page starts from `defaultOfferDeadline`:
  the event's Confirm by when that's after the later of now and the release,
  otherwise a week after that moment at 11:45 PM Pacific. Changing Confirm by
  never moves offers already made.
- Other refusals: `NOT_FOUND`, `NOT_SUBMITTED` (a draft), `HAS_TICKET` (the
  offer is registered), `NOT_ALLOWED` (a move the table forbids after release).

The review list's "Seats held X of N" card counts tickets and offers out
(`event_seat_counts`).

### Decision release

"Release decisions on" (`event_application_settings.decisions_release_at`)
holds every decision back from applicants until it passes;
`application_decisions_released(event)` is true once it has, or when none is
set. Before then:

- "applications: read own" shows an applicant only their draft or submitted
  rows, and `get_my_event_applications` (what the portal reads) reports a
  decided application as `submitted`, with no `offer_expires_at` and no
  `updated_at`. It always returns `decisions_release_at`, and the panel says
  when decisions come out. Applicants still read their own answers.
- Checkout and reservation refuse an offer with `APPLICATION_REQUIRED`
  (`event_ticket_eligibility`).
- Admins see and change decisions as usual; the decision card says "Hidden
  from {first name} until {release}".

The portal shows the decision on the first load after the release; nothing
pushes it to an open page. Once applicants can see decisions (the release has
passed, or none was set and some application is decided), the release can't
move into the future (`EVENT_SETTINGS_CONFLICT`).

### Application emails

Applicants get plain, fixed-copy emails through Resend
(`src/lib/email/application-templates.ts`). A production-only job sends
them within about five minutes of becoming due (setup and limits:
supabase/README.md, "Application emails"):

| Email | Sent when |
| --- | --- |
| Accepted ("You're in", confirm by the deadline, button to the portal event page) | The decision is `accepted` and released, and the offer hasn't expired |
| Waitlisted (a spot that opens up shows in the portal) | The decision is `waitlisted` and released |
| Not selected | The decision is `rejected` and released |
| Offer reminder (confirm by the deadline, button) | An accepted, released offer expires within 24 hours, and its acceptance email went out before those 24 hours began |

- Each email goes once per application and decision, so a decision that
  changes after release (waitlisted to accepted, accepted to rejected) sends
  the new one. A new deadline on the same offer sends no new acceptance, but
  gets its own reminder.
- Nothing is sent for a canceled event, a draft (unpublished) event, an event
  that has ended, an event that no longer requires applications, a deleted
  account, or an applicant who already has a ticket. Before release nothing is
  sent, so decisions changed before then send only the final one.
- No email when an offer expires, and none when an application is submitted.
- Decisions released before the job shipped were marked sent when it
  deployed, so nobody got an email for them.
- Nothing is sent while student events are off (`FLAGS.studentEvents`).

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

## Students: event states

A student is in exactly one state for each event, worked out by
`eventStateFor` in `src/features/events/lib/event-states.ts`. The badge on the
event card and event page (`eventBadgeFor`) and the event page's registration
panel both read that state; neither decides it.

Events without applications go `reg-open` → `reg-going` → `reg-checked-in` →
`reg-past-attended`. Events with `requires_application` go through the `app-*`
states first, and an accepted student joins the same ticket states once they
register.

| State | Badge | When |
| --- | --- | --- |
| `canceled` | Canceled | The event was canceled and hasn't ended, ticket or not |
| `reg-upcoming` | Opens Oct 12 | Before `registration_opens_at` |
| `reg-open` | Registration open | Registration is open and seats are left |
| `reg-full` | Full | No seats left; can reopen if an offer expires |
| `reg-closed` | Registration closed | After the close |
| `reg-going` | Going | They have a ticket |
| `reg-checked-in` | Checked in | A check-in on their ticket is active ([below](#multi-day-check-in)) |
| `reg-past` | Past | The event has ended and they had no ticket |
| `reg-past-attended` | Past | The event has ended and they had a ticket |
| `app-upcoming` | Opens Oct 12 | Before `registration_opens_at`, for an application event |
| `app-open` | Applications open | Applications are open and they haven't started one |
| `app-draft` | Draft | Their application is a `draft`, and applications are open |
| `app-in-review` | Pending | Their application is `submitted`, or decided but not yet released; before release the panel says when decisions come out |
| `app-waitlisted` | Waitlisted | Their application is `waitlisted` |
| `app-accepted` | Register by Oct 20 | Accepted, before the offer deadline, no ticket yet |
| `app-rejected` | Not selected | Their application is `rejected` |
| `app-missed` | Applications closed | Applications closed and they never started one |
| `app-draft-expired` | Applications closed | Applications closed before their draft was submitted |
| `app-offer-expired` | Applications open, or Applications closed | Accepted, but the deadline passed without registering; the badge follows the window |

- **The close** is `registration_closes_at`. When it's empty, registration for
  an event without applications stays open until the event starts (a UI rule:
  the database treats an empty close as no limit), and applications stay open
  until the event ends. The application window is the apply page's own
  (`applicationWindow`), so the panel and the apply page always agree.
- **An event ends** at `ends_at`, or at `starts_at` when it has no end.
- **A boundary instant** belongs to the earlier side, as in the database:
  registration is open at `registration_opens_at` and still open at the
  close, an event hasn't ended at `ends_at`, and an offer lapses at
  `offer_expires_at`.
- **Decisions outlast the close.** Applications closing only stops new
  applications: `app-in-review`, `app-waitlisted` and `app-accepted` stand,
  and an accepted student can register until their offer expires.
- **Application events are never Full.** Accepted offers hold their seats, and
  the database doesn't check seats for an application event, so an open
  window reads as `app-open` however many seats are left.
- **An expired offer** reads as Applications open while the window is open
  (they'll be able to reapply once that exists) and Applications closed after.

### Registration panel

The portal event page's Registration card (`RegistrationPanel`) renders the
state as one of three layouts: an alert, an action with one button, or the
ticket. `getPanelSpec` in `src/features/events/lib/registration-panel.ts`
holds each state's layout and copy. The card is titled Application while the
student is applying and Registration otherwise, including once they're
accepted. The ticket is locked until they register, and View ticket opens the
"Your ticket" dialog with the scannable code.

`canceled` is an alert titled "This event has been canceled", never the
ticket, so the QR code is hidden. Its text is the club's note, then the
refund line for a paid ticket: "Your payment has been refunded." once
`purchases.refunded_cents` covers the amount, otherwise "Refunds are handled
by the club." A free ticket gets "You don’t need to do anything." when there's
no note.

Badges for a canceled event:

| Where | Before it ends | After it ends |
| --- | --- | --- |
| Portal event page and timeline | Canceled (`eventBadgeFor`) | Past |
| `/events` card | Canceled (`isCanceledEvent`) | No badge, as any event |
| `/events/[slug]` | Canceled, the note, and a disabled "Event canceled" button | As any past event |
| Admin drawer and builder | Canceled, always | Canceled, always |

### When more than one applies

Use the first rule that matches:

0. The event was canceled and hasn't ended: `canceled`, with their ticket if
   they have one. Once it ends, the rules below apply as for any event.
1. The event has ended: `reg-past-attended` if they had a ticket, otherwise
   `reg-past`.
2. They have a ticket: `reg-checked-in` or `reg-going`, over any application
   state.
3. An application event: a submitted or decided application's state
   (`app-in-review`, `app-waitlisted`, `app-accepted`, `app-rejected`,
   `app-offer-expired`), even before registration opens, in case an admin moved
   the opening later. Then `app-upcoming`, then `app-draft` or
   `app-draft-expired` for a draft, otherwise `app-open` or `app-missed`.
4. Otherwise: `reg-upcoming`, then `reg-closed`, then `reg-full`, then
   `reg-open`. Closed beats Full so that students can't register even if spots
   open up.

So a student who's going to an event that has since filled up still sees
"Going", not "Full".

### Multi-day check-in

Each check-in belongs to one of the event's check-in sessions. A student is
`reg-checked-in` from the moment of a scan until that session's `end_time`, or
until the event ends when the session has no end time, and `reg-going` before
their first scan and between sessions. Any active check-in counts when
sessions overlap. Unticking a check-in in the admin table returns them to
`reg-going`.

The page reads the state when it loads, so it changes on the next visit or
refresh rather than live.

## Students: teams

Only for events with `teams_enabled`. Teams form after registering: every
team action needs a ticket to the event.

- A student creates a team, which gets an invite link, or joins one with a
  teammate's link. They're on at most one team per event.
- A team holds up to `max_team_size` people; its link stops working when full.
- The owner can rename or delete the team; deleting removes everyone on it.
  Anyone else can leave. The owner can't leave without deleting it.
- An unnamed team shows as its owner's: "Aubrey's team".
- An invite link is `/join/<code>`. It signs the student in, then opens
  "Join [team]?" on the event's portal page (`?join=<code>`). The team card
  shows only to ticket holders.
- At `team_deadline` teams lock: nobody creates, joins, renames, leaves or
  deletes, and admins place anyone without a team. A team admins make has no owner.
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

## Saved builder configuration

The form-first builder stores desired marketing and pricing configuration in
`events.configured_marketing_mode`, `configured_marketing_url`, `configured_slug`,
`configured_pricing_mode` and `configured_price`. `configured_slug_edited`
remembers whether the URL was deliberately edited, so automatic URLs continue
following name changes after reload. The drawer marketing action uses the saved hosted/external destination;
staff draft previews use the marketing layout. Existing operational consumers read
`slug`, `marketing_url`, `regular_price` and `member_price`; unrelated form
updates omit effective prices. `is_featured` saves the staff choice without
claiming portal Home selection/display is delivered.

On a draft, Save applies the builder's edits to the event through the same
validated transaction as Update and publication, and the event stays a draft.
The builder never stores edits apart from the event: an incomplete form can't
be saved (Save reveals what's missing, like Publish), and leaving
discards unsaved edits. An existing unpublished event has one active URL: a
save synchronizes `slug` and `configured_slug` in the same transaction.
The new URL works immediately for staff; the old URL stops resolving and its
claim is released. URL lookup retains its existing status/RLS visibility.
Automatic URLs are numbered past other events' claims for duplicate names under
the save transaction lock, including complete/publication saves;
deliberately edited conflicting URLs are rejected without committing either
the document or rename. The returned canonical URL and saved `event_revision`
keep the editor and subsequent publication revision checks in sync. A retry
returns the original saved revision, rather than adopting later event writes.
The first Save creates its permanent event/portal identity: the builder
writes a working document to get a durable ID that a lost response can retry
against, then applies the same edits, which clears that document.
The editor disables the URL field with the library's grey disabled style after
first publication, including when that event is later returned to Draft.

New Free/Paid configuration activates `pricing_policy = 'figma'`, synchronizing
`regular_price` to the configured non-member amount and `member_price` to zero.
Active membership requires both personal expiry and club-term checks. Existing
legacy events retain their policy/amounts on unrelated saves; explicitly changing
pricing configuration converts an eligible event. The temporary pricing
publication/scheduling/registration blockers have been removed. Staff may still
test-register on free drafts (see "Drafts for admins"); ordinary required-field,
authorization and pricing locks remain.

`initialize_event_checkout` snapshots paid prices under the event lock. A zero
amount reserves its ticket and completes the zero-dollar purchase in one
transaction, without Square customer creation, card collection or a charge.
The purchase supplies existing history, confirmation and receipt paths; its ticket
supplies Going/private access, QR and check-in. Equal attempt keys return the
same receipt; a refused attempt, free or paid, leaves no purchase, since
eligibility runs before the insert (see "Live purchases"). A changed quote
requires refresh rather than charging an unreviewed amount.

`first_published_at` records first activation and survives a return to Draft.
Existing active rows are backfilled when the migration runs. Both effective
and configured URLs lock after publication. Pre-publication desired URLs share
an atomic claim namespace with existing event slugs, so collisions cannot be
saved under concurrent requests. Marketing mode/external URL configuration
remains independently editable; existing public destinations are preserved.

Pricing configuration and effective prices lock when an event has a ticket,
an unexpired accepted offer, or a live purchase (including an in-flight
payment; see "Live purchases"). Purchase/ticket/offer writes take the event lock used by reservation;
form checks run after that lock and see committed registrations. Historical
purchase amounts and ticket records are never rewritten by configuration saves.
`admin_event_pricing_locked` exposes only the staff aggregate; URL claims have
no browser grants. The event's existing RLS and staff server-action guards
continue to govern form access and writes.


### Application editor settings

The admin builder saves application timing in staff-only
`event_application_settings`, separately from public event rows and existing
per-offer `offer_expires_at`. Release decisions on and Confirm by are optional
Pacific moments; entered values need a complete, unambiguous date and time, and
confirmation follows release when both are set. Release decisions on holds
decisions back from applicants ([Decision release](#decision-release)) and
can't move into the future once applicants can see decisions. Confirm by is
the default deadline for new offers; changing it doesn't move outstanding
offers, reopen expired ones or send emails.

First submission records a durable `questions_locked_at`. Application drafts
alone do not lock questions. After submission the builder shows ordered summaries,
and direct question writes and atomic saves reject changes, additions, removals
and replacements. Unchanged saves preserve question/response identity and stored
descriptions. The lock survives application removal. Event deletion retains its
existing payment protections and cascade behaviour. Question edits and submission
serialize on the event row; submission validates the question set it locks.

Before that lock, the builder supports Short form, Long form, Checkboxes,
Multiple choice, Dropdown and one private PDF up to 5 MiB; Required, optional
positive integer text limits, choice options and ordering persist. Description
controls are omitted without clearing existing descriptions. Staff working drafts
can contain incomplete questions and moments; materialized Application events
need at least one valid question before publication or scheduling through the
builder. Member upload/response permissions retain their existing contract.

### Finding an issued event ticket

The attendee’s `/portal/events/<slug>` page reads their own ticket and renders
**Registration** below the event details. It shows a shared Ticket with its signed
QR and **View ticket**, which opens a larger scannable code. Signing stays on the
server and uses the authenticated attendee’s ticket ID, never an ID supplied by
the browser. A Going badge alone does not supply the ticket view. Checked-in
attendees keep their ticket/code; people without a ticket see no issued QR.
Completed checkout invalidates the event detail route as well as checkout.


### Unified saved drafts and staff previews

The first Save creates the permanent `events.id`. Save applies
validated edits, so the builder no longer leaves a working document behind; one
exists only on drafts saved before that change, until their next save. Such
unscheduled drafts may have missing capacity, prices, description and dates.
`working_document` retains
unfinished nested sections and exact saved form strings; `working_revision` and
`events.revision` protect competing edits. Related operational tables are written
on a validated full save/publication. Publication/scheduling clear the working
document atomically; published edits remain local until Update. Quick publication
of a saved document uses the same complete builder validation and transaction.
The database rejects private documents on scheduled/published rows and checks
publication readiness, including scheduler and quick-edit transitions.

Every saved event, including a first-save draft, opens `/admin/events/<id>` in
the drawer. Its editor is `/admin/events/<id>/edit`; legacy draft routes redirect
there using recorded aliases. Protected deletion includes unfinished images and
releases URL claims. Staff can visit the latest saved draft through its canonical
portal slug, including while public event browsing is gated. Hosted marketing
previews use `/events/<slug>?preview=draft`: admin/manager only, 404 for everyone
else, no response caching, a draft notice, and disabled registration/application
actions. Public browsing keeps its feature gate. The drawer's marketing action
uses the saved hosted slug or a validated saved external URL, and hides unavailable
destinations. Renaming activates the new slug atomically; the old URL returns 404.
