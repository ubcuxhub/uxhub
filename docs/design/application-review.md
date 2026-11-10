# Application review and reviewer notes

Design for the admin "review applications" pages and the reviewer-notes thread
(Applications & registration epic, docs/epics.md). Built as working UI on
fixture data in the dev docs; no production page, migration or helper changes.

Where to look (run `pnpm dev`, no sign-in needed):

| What | Where |
| --- | --- |
| Reworked list (filters, counts, sort, place-keeping) | `/dev/templates?open=applications` |
| Reworked application page (answers, decision, notes, pager) | `/dev/templates?open=application-review` |
| Reviewer notes thread, interactive | `/dev/gallery`, column 4, `reviewer-notes` |
| Notes empty / loading / load failed | `/dev/gallery`, column 4, `reviewer-notes-states` |
| Application header with pager at phone width | `/dev/gallery`, column 4, `applicant-header` |

Each template also renders in a 375px iframe, and both work in dark mode.
Screenshots are in [`application-review/`](application-review/).

New code the real pages can use as is:

- `src/features/applications/components/ReviewerNotes.tsx` (+ tests): the thread.
- `src/features/admin/components/ApplicantPager.tsx`: "3 of 23 · Submitted" with previous and next.
- `src/features/admin/components/ReviewStateBadge.tsx`: one label per review state.

Design-only: `src/app/dev/templates/application-review.tsx` (the two pages and
the decision card, in local state), `src/app/dev/gallery/_review-fixtures.ts`.

## 1. What the library already offers

Everything here is composed from existing primitives; nothing new was added to
`src/components/ui` or `src/components/shared`.

| Need | Use | Notes |
| --- | --- | --- |
| Page frame, back link | `PageContainer`, `BackButton` | §4.5: name the parent ("Back to applications") |
| List | `TableCard`, `Table` (`stickyFirstColumn`), `TableRowButton` / `TableRowLink`, `TableNone`, `TableEmpty`, `TableSkeleton`, `Pagination` + `TableRowCount` | Same shape as Manage Users (`AdminUsersManager`). `aria-current` on the opener fills the row you came from |
| Search, sort, filter | `TableToolbar`, `SearchField`, `SortFilterPanel`, `ChipFilterSection`, `FilterChip` (with `count`) | §3.16, §3.3 |
| Progress at a glance | `StatCard` (`value`, `rate`) | "Seats filled 15% · 9 of 60 seats" |
| Status | `StatusBadge` with a status or custom `label`/`tone`/`icon` | Has `offer_expired`, `waitlisted`, `accepted`, `going` |
| Person | `Avatar` (`anonymous` already exists for "Deleted user"), `AvatarGroup` | |
| Cards | `Card`, `CardHeader/Title/Description/Content` | `CardTitle` is a `div`; give it `role="heading"` + `aria-level` |
| Answers | `ApplicationAnswersReadOnly` (applications feature) | The student's read-only view. Numbered, separated, file links. Admins should use it too |
| Actions on your own item | `DropdownMenu` + `IconButton` (ghost, `icon-sm`), destructive item last after a separator | §3.7 |
| Confirm | `ConfirmDialog` (`pending`, `error`, `returnFocusRef`) | Title asks, buttons name both outcomes |
| Writing | `Field`, `FieldLabel`, `FieldError`, `FieldDescription`, `Textarea` (`showCount`, live "N characters left") | |
| Deadline | `DateTimeField` (container-query sized, Pacific) | Replaces the raw `datetime-local` input |
| Feedback | `toast` (with an action), `EmptyState` (`inline`/`card`/`page`), `Skeleton`, `Button loading` | §3.8, §4.4f: skeletons not spinners |
| Moving between records | `SidePeekDrawer` / `RecordDrawer` pattern (Manage Users) | Considered; see §3 |
| Sections of one object | `TabNav` (Overview / Applications 12 / Check-in) | Only in the dev docs so far; production admin event pages use the record drawer |

Already in the dev docs before this work: `applicant` (production
`ApplicantInfoCard`), `application-response`, `application-decision`
(production `StatusUpdateSection` plus a reject confirm), and a sketch
`reviewer-notes` composition (hand-rolled state, `when` strings, own notes as
"You"). The sketch is replaced by the real component; the other three are left
alone because they document what is in production today.

Conventions that shape the design (docs/design-system.md):

- Terminology (§2.9): "Applicant" in review; never "registration" while a
  decision is pending; a registrant's status is always "Going"; User only in
  admin contexts. Title Case for page titles only, sentence case for headings,
  buttons, labels and badges.
- One primary button per view (§3.1). On the application page that is the
  decision ("Accept"), so "Post note" and "Save note" are secondary.
- Every admin result gets a toast; success confirms without celebration (§3.8).
- Status never by colour alone: badge icon + word (§2.10).
- Colour classes: shadcn vocabulary only; nothing in this design adds a colour.

Gaps found (none block this design):

- No shared mapping from `ApplicationReviewState` to a badge.
  `ApplicantInfoCard` maps four states privately and renders the other two as
  a neutral `Badge`; the list prints a different word. Added
  `ReviewStateBadge` (§4).
- No "relative time" helper in `src/lib/date.ts`. `formatNoteTime` lives in
  `ReviewerNotes.tsx` for now; move it to `lib/date` if the audit-log activity
  feed wants the same wording.
- `BackButton` and the pager are links; the gallery has no routes, so the
  templates intercept the click. Real pages use real hrefs.
- Templates lay out by viewport breakpoints, which is wrong inside the docs
  frame and inside the admin shell (sidebar). The application page uses
  container queries (`@container`, `@4xl:`) so its two columns appear only
  when the content area itself is wide enough. Worth doing for any new admin
  page that has an aside.

## 2. The current pages, audited

`ReviewApplicationsClient` / `ApplicationListCard` (list) and
`ApplicationReviewClient` / `ApplicantInfoCard` / `ApplicationResponseCard` /
`StatusUpdateSection` (one application), built Dec 2025 without a design.

List:

1. Doesn't scale to 50+. Each applicant is a full `Card` (about 120px), one
   per row, so 50 applicants is about 6,000px of scrolling with no paging.
2. Status filters are `Button`s toggling primary/secondary, not `FilterChip`s,
   with no counts, so "how many are left to review?" needs counting by hand.
3. Plain `Input` for search: no clear button, no result count, no live
   announcement (`SearchField` does all three).
4. Filters and search live in component state. Opening an applicant and coming
   back resets them; only `?filter=submitted` is read, and only on load. This
   is the "losing place" problem.
5. No sort. The helper sorts newest first, the opposite of a fair review queue.
6. The status is printed twice in different words: an unlabelled coloured icon
   and the raw label ("Submitted"), while the detail page's badge says
   "Pending" for the same state.
7. Copy: "Review Applications", "Clear Filters", "Filter:" (§2.9 sentence
   case; filters are nouns without a label); "Back to Events" is not the
   parent's name ("Manage Events").
8. Hand-rolled dashed empty state instead of `EmptyState`.
9. Nothing about capacity, though accepting depends on it.

Application page:

10. "Back to Events" goes to `/admin/events`, not to the list the reviewer came
    from, so every applicant costs three navigations and the filters are lost.
11. No previous/next between applicants.
12. The heading is "Application Review"; the applicant's name is in a card
    below it, so the page title and the screen-reader heading never say whose
    application it is.
13. The decision is at the very bottom, under every answer.
14. Reject (and "Take back offer") has no confirmation, though the decision is
    final. (The gallery composition adds one; production doesn't.)
15. A full-screen `SuccessOverlay` after every decision interrupts a 50-person
    review session; §3.8 asks for a toast.
16. While a decision saves, every button turns into "Updating..." with a
    spinner (three spinners, ASCII ellipsis).
17. Raw `datetime-local` input labelled "(Pacific)", re-typed for every
    acceptance; `DateTimeField` exists.
18. Each answer is its own `Card`; the student already has
    `ApplicationAnswersReadOnly`, numbered and lighter.
19. Errors print the raw `Error.message` and `console.error`.
20. No reviewer notes, no sense of whether anyone else has looked.

## 3. Decision: rework both pages, keep the routes

Recommend the rework. Points 1–5 and 10–11 together make a 50-applicant review
needlessly slow (no counts, no paging, three navigations per applicant, filters
lost each time); the rest is consistency with the system. The routes and data
stay as they are, so the rework is UI plus URL state.

Considered and rejected: opening an application in a `SidePeekDrawer` over the
list (the Manage Users pattern). It keeps place for free, but the drawer is
560px, and reviewing means reading long answers, reading and writing notes,
and setting a deadline at once. The drawer pattern also says to use a page
when a decision is required. A page with previous/next and a list that
remembers its state gets the same "never lose my place" with room to read. A
review URL can also be pasted to another exec ("can you look at this one?").

### List (`/admin/events/[event]/review-applications`)

- Title "Applications", subtitle with event name, close date and event date.
  Back to Manage Events.
- Three `StatCard`s: To review (submitted), Offers out (accepted, no ticket),
  Seats filled (rate of capacity). Accepting is a capacity decision; this
  puts the number in front of the reviewer.
- `TableToolbar`: search (name or email); Sort and filter panel with Sort by
  (Oldest first default, Newest first, Name A to Z, Fewest notes first) and a
  Reviewer notes filter (Has notes, No notes yet).
- One row of status `FilterChip`s with counts, in queue order: Submitted,
  Waitlisted, Accepted, Going, Offer expired, Rejected. Entering from the event
  drawer's "Review applications" button selects Submitted.
- Table: Applicant (avatar, name, program on a second line), Submitted
  ("Oct 24"), Notes (icon + count, or an en dash read as "None"), Status
  (`ReviewStateBadge`). The whole row opens the application
  (`TableRowLink`). 25 per page (the template uses 10 to show paging);
  `TableRowCount` with "Show all".
- All of it in the URL: `?status=submitted&sort=oldest&q=&notes=&page=2`, so
  back, refresh and sharing keep the view. Rows link with the same query.
- Back from an application: the row you came from is filled (`aria-current`)
  and focused, and the page is the one it's on (as a drawer's close does,
  §3.15).
- Empty: `EmptyState` (page size) "No applications yet"; a filter with no
  results: `TableEmpty` plus "Show all".
- Wider than a phone, the table scrolls sideways with the name column pinned.

### Application (`…/review-applications/[applicationId]`)

- Back to applications (the list URL with its query).
- Header: 56px avatar, the name as the `h1` (focused on arrival, so moving to
  the next applicant is announced), `ReviewStateBadge`, program and email
  (mailto), "Submitted Oct 24, 2026, 11:42 AM". On the right,
  `ApplicantPager`: "3 of 23 · Submitted" with previous and next, both
  carrying the list's query. Neighbours are by the list's sort, with the
  current applicant held in place even after a decision moves it out of the
  filter, so Next never skips anyone.
- Body: two columns when the content area is at least 56rem (container
  query), else one. Left: Answers card (`ApplicationAnswersReadOnly`). Right,
  in this order: Decision, then Reviewer notes.
- One column (phone, narrow window): header, answers, decision, notes. DOM
  order equals visual order at every width; nothing is reordered with CSS.
- The aside is not sticky. A sticky aside with its own scroll would need an
  inner scroller around a growing thread; the header's pager and a short
  answers column make scrolling back cheap enough.

### Decision card

- Title "Decision"; the description says what can happen now, in the
  applicant's first name ("Priya has until Nov 11, 2026, 11:45 PM to register.
  Move the deadline, or take the offer back.").
- When accepting is possible: "Register by" `DateTimeField` + "Pacific Time.
  If Priya hasn't registered by then, the spot opens up again." Prefilled with
  the current deadline (accepted) or a default; in the app the default should
  be the last deadline this admin used for this event.
- Buttons by state (`getApplicationDecisions`): Accept (primary) / Waitlist /
  Reject; accepted: Move deadline / Take back offer; offer expired: Offer
  again / Reject; registered and rejected: none. Only the pressed button
  shows a spinner; the rest are disabled.
- Reject and Take back offer confirm: "Reject Priya's application?", "Priya
  will see "Not selected" on the event page. You can't undo this.", Keep
  reviewing / Reject. (No email is promised: decision emails are later.)
- Success is a toast ("Priya accepted", "Register by …") with a "Next
  applicant" action; the pager offers the same, since a toast never takes
  focus. No overlay.

## 4. Status copy

One word per state, the same on the badge, the filter chip and the decision
card (`REVIEW_STATE_BADGES`):

| Review state | Label | Tone, icon | Student sees |
| --- | --- | --- | --- |
| `submitted` | Submitted | warning, `inbox` | Under review |
| `waitlisted` | Waitlisted | warning, `hourglass` | Waitlisted |
| `accepted` | Accepted | info, `circle-alert` | Register by Nov 11 |
| `registered` | Going | success, `circle-check` | Going |
| `offer_expired` | Offer expired | neutral, `clock-alert` | Offer expired |
| `rejected` | Rejected | neutral, `circle-minus` | Not selected |

"Submitted" over "Pending": it is the admin word already in
`APPLICATION_REVIEW_STATE_LABELS` and the database. "Going" over "Registered":
§2.9 says a registrant's status is always Going. `APPLICATION_REVIEW_STATE_LABELS`
should change `registered` to "Going" when this ships.

## 5. Reviewer notes

### Placement

On the application page, in the aside under the decision. Notes inform the
decision and are read beside the answers, so they sit next to both; under the
decision because the decision is the page's primary action and is short. On
one column they follow the decision.

### Anatomy

- Card: "Reviewer notes" (`h2`), description "3 notes · Only admins see these".
- Thread, oldest first (a conversation reads top down): 32px avatar; name in
  medium weight, "(you)" on your own; " · " time; " · Edited" if edited.
  Body in `text-small`, foreground, line breaks kept, long words broken.
- Time: "Just now", "12 min ago", "3 hr ago" (same Pacific day), "Yesterday at
  4:05 PM", "Nov 2 at 9:30 AM", "Nov 2, 2025". A `<time datetime>` with the
  full timestamp as its title; ticks every minute; on the server and during
  hydration the full timestamp, so server and client agree. "Edited" has the
  edit time as its title.
- Long notes: cut at six lines with a fade, "Show more" / "Show less"
  (`aria-expanded`, `aria-controls`). Not `line-clamp`: its ellipsis can land
  alone on a blank line between paragraphs.
- Deleted account: "Deleted user" in muted text, `Avatar anonymous`, no photo,
  the note kept (same convention as the audit-log epic).
- Your notes only: a ghost `…` button ("Edit or delete your note") opening
  Edit note / separator / Delete note.
- Composer under the thread, after a separator: label "Add a note",
  placeholder "What stood out? Strengths, concerns, a team they'd suit",
  counter "0/2000", hint "Ctrl or ⌘ + Enter to post" (hidden on touch),
  secondary "Post note".

### Behaviour

- Post: trims; empty can't post. The button shows "Posting…"; the text stays
  read-only until done, then clears, focus stays in the composer, and "Note
  posted" is announced. On failure the text stays and a field error says
  "Couldn't post your note. Check your connection and try again."
- Edit: the body becomes a textarea in place, focused with the caret at the
  end; Cancel (ghost) / Save note. Ctrl/⌘+Enter saves, Esc cancels. Saving
  without changes just closes. Focus returns to the `…` button. "Note saved"
  is announced. Failure keeps the edit open with an error.
- Delete: `ConfirmDialog` "Delete your note?", "Other reviewers won't see it
  any more. You can't undo this.", Keep note / Delete note ("Deleting…").
  Failure shows in the dialog. After deleting, focus moves to the composer
  (the note and its button are gone) and "Note deleted" is announced.
- Not optimistic: the thread shows only what the server accepted, so two
  reviewers never see a note the other can't. Refresh (or a realtime
  subscription, later) brings in other reviewers' notes.
- Loading: three skeleton rows, `aria-busy`, "Loading notes" for screen
  readers, no composer. Load failed: inline `EmptyState` "Couldn't load notes"
  / "Check your connection, then try again." / Try again. Empty: "No notes
  yet" / "Share what stood out, so other reviewers can weigh in." with the
  composer.

### Keyboard and screen readers

- The card is a region named by its heading; the thread is an `ol` named
  "Reviewer notes"; each note is a list item read as name, time, edited,
  body.
- Tab order: Show more (if any), your note's `…`, composer, Post note. The
  menu follows Radix (arrows, Enter, Esc returns to the button).
- `aria-keyshortcuts` on both textareas; the counter announces the last 20
  characters.
- Announcements go through one polite live region in the card.

### Note count in the list

Yes: a Notes column with the count and a "Fewest notes first" sort and
"No notes yet" filter. It answers "has anyone looked at this one?" and helps
spread reviewing across execs without assigning reviewers. Unread or "new
since you looked" markers are out of scope (they need per-admin read state).

## 6. Data the UI needs (for the backend)

Not a migration; the shape the components expect.

Table `application_review_notes`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid, fk `event_applications` on delete cascade | |
| `author_id` | uuid, fk `user_info` | Accounts are anonymised, not deleted (`user_info.deleted_at`), so the fk holds |
| `body` | text, check `char_length(btrim(body)) between 1 and 2000` | Plain text; line breaks kept; no Markdown or mentions yet |
| `created_at` | timestamptz default now() | |
| `edited_at` | timestamptz null | Set by an update that changes `body`, never on insert. Drives "Edited" |

Index on `(application_id, created_at)`. Hard delete (the dialog says it can't
be undone); the audit log's admin change log can keep history if wanted.

RLS (`is_admin()` covers admins and managers):

- select: `is_admin()` and the application is not a draft (admins never see
  drafts).
- insert: `is_admin()` and `author_id = auth.uid()` and the application is not
  a draft.
- update (body only): `is_admin()` and `author_id = auth.uid()`.
- delete: `is_admin()` and `author_id = auth.uid()`.
- Applicants: no access, ever. A demoted admin keeps authorship but loses
  access; their notes still show with their name.

What the page reads (one query, oldest first):

```ts
type ReviewerNote = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; name: string; avatarUrl: string | null; deleted: boolean };
};
```

`author.deleted` is `user_info.deleted_at is not null`; the UI then ignores
name and photo. The list needs `noteCount` per application (a count joined into
`fetchEventApplicationSummaries`, or a view). Mutations as server actions
(`addReviewerNote`, `editReviewerNote`, `deleteReviewerNote`) that throw on
failure; `ReviewerNotes` turns a throw into the inline error. Log failures at
`warn` with ids only (never the body).

## 7. Not verified

- Real data, RLS and server actions: none exist yet; everything is fixtures.
- Long-thread performance (hundreds of notes) and realtime updates.
- Screen-reader passes (VoiceOver, NVDA) by a person. Keyboard paths and focus
  moves were checked in headless Chrome; announcements only by reading the
  live region's text.
- 200% zoom.
