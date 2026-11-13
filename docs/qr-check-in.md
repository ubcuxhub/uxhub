# QR check-in

Plan for the Event tickets epic: a 2D ticket with a QR code on the portal event
page, a phone scanner for admins at the door, and a manual lookup for codes that
won't scan. Target: Nov 12, 2026.

## What exists

- **Token:** every `event_tickets` row has a random `qr_token` (32 hex
  characters). The ticket's QR code holds it, and a scan looks the ticket up
  by it.
- **Ticket:** [`EventTicket`](../src/features/events/components/EventTicket.tsx)
  shows the event, the holder, and the check-in QR code. Its badge is one of
  the student-facing badges in `docs/event-states.md`. The code shows for Going
  and Checked in, drawn from the `qrToken` prop with
  [`QrCode`](../src/features/events/components/QrCode.tsx). Build its `event`
  prop with [`toTicketEvent`](../src/features/events/lib/ticket.ts).
- **Check-in data:** `check_in_sessions` (one or more per event) and
  `check_ins` (one row per ticket per session, unique on that pair).
  `/admin/events/[event]/check-in` lists tickets with a search box and a
  per-session check-in toggle (`toggleCheckInAction`), and links to the
  scanner.
- **Scanner:** `/admin/events/[event]/check-in/scan`, a phone camera scanner
  with a "Can't scan?" lookup by name or email.

## Which token

IDs show up in admin URLs, so a QR code holding a bare ID would let anyone make
a working ticket. The code has to hold something only the server could issue.

The token never expires or changes, so a screenshot scans as well as the live
page. Reuse is stopped at the door: the second scan finds the existing
`check_ins` row and shows "Already checked in at 10:02".

**Decided (2026-10-23): use `qr_token`.** `event_tickets` (see
[registration-rollout.md](registration-rollout.md)) gives every ticket a unique
random `qr_token`, and check-in has moved from registrations to tickets. The
signed token is being replaced because:

- it was built to sign registration IDs, and `event_registrations` is gone;
- a per-ticket secret can be revoked by regenerating that one token, without
  rotating `CHECK_IN_TOKEN_SECRET` and invalidating every ticket;
- 32 hex characters make a smaller QR code than an ID plus a signature;
- there is no secret to set per environment.

A scan looks the token up together with the event being scanned, so a valid
ticket for another event is rejected. The signed token and
`CHECK_IN_TOKEN_SECRET` are gone; no signed code was ever issued, so nothing
needed migrating.

## Who gets a ticket

Anyone with an `event_tickets` row, the same set the check-in table lists. Paid
fulfillment issues it through `reserve_event_ticket`. The states doc says a
registered person stays registered, so the ticket has no cancelled state.

## Build steps

### 1. Real QR on the ticket (done)

- `EventTicket` draws `qrToken` as an SVG with
  [`toQrSvg`](../src/features/events/lib/qr-code.ts): error correction level
  M, a four-module quiet zone, 192 px, black on white in both themes.
- The page that places the ticket loads the viewer's ticket in a server
  component (`fetchUserEventTicket`) and passes its `qr_token` as `qrToken`.
  The token is fine to send to its owner's browser: it is their ticket.
- Render `EventTicket` from a server component where possible, so the `qrcode`
  package stays off the client.
- Show the ticket only to its owner; the page already runs `requireAuth()`.

### 2. Check-in by token (done)

Two server actions in [`actions.ts`](../src/features/admin/actions.ts), both
behind `requireAdmin()` (admins and managers):

- `checkInScannedTicketAction(sessionId, code)` for a scan. A code that isn't
  32 lowercase hex characters, or matches no ticket, is "Not a UX Hub ticket".
- `checkInTicketAction(sessionId, ticketId)` for the manual lookup. No token is
  needed, because the admin is already authorized.

Both reject a ticket for another event ("Ticket is for a different event") and
return `CheckInResult`: `checked_in` or `already_checked_in` with the name and
time, or `rejected` with a reason. They log `check_in.recorded` and
`check_in.rejected` with IDs only.

The check-in itself is `checkInTicket` in
[`check-ins.ts`](../src/lib/supabase-helpers/check-ins.ts), which the toggle on
the check-in page uses too. It keeps the first time, and two scanners on the
same code can't both win: it inserts on the unique (ticket, session) pair with
`ON CONFLICT DO NOTHING`, then reads the existing row. No migration was needed.
Un-checking deletes the row, so the ticket can be checked in again; a row an
older un-check left with no time is stamped.

### 3. Scanner page (done)

`/admin/events/[event]/check-in/scan`, under the existing admin guard
([`CheckInScanner`](../src/features/admin/components/CheckInScanner.tsx)).

- **Camera:** `qr-scanner` with the rear camera, since iOS Safari has no
  built-in QR reader (`BarcodeDetector`). Camera access needs HTTPS, so test on
  a phone through a preview deploy, not `localhost`. A blocked or missing
  camera says what to do, and the lookup still works.
- **Session picker:** defaults to the session running now, else the next one,
  else the last one.
- **Result card:** green with the name for a fresh check-in, amber with
  "Already checked in at 10:02 AM", red with the reason for a rejection. The
  camera pauses until the admin taps "Scan next", so one code is submitted
  once. Right after "Scan next", the same code is ignored for 3 seconds, so a
  ticket still in view doesn't come back as "Already checked in".
- **Phone only:** the scanner shows when `(pointer: coarse)` matches. On a
  laptop it says "Open this on your phone" with a QR linking to the page. This
  is a UX gate, not security; `requireAdmin()` stays the access control.

### 4. Manual lookup (done)

"Can't scan?" swaps the camera for a name or email search over the event's
tickets, the same search as the check-in page (`searchCheckInAttendees`). It
reloads the list when opened, so tickets bought since the page loaded show up.
Picking someone calls `checkInTicketAction` and shows the same result card.

## Testing

- **Unit:** the QR scans back to the token; both actions for each outcome,
  with Supabase mocked; result copy; session default; the scanner flow with a
  stand-in camera (one submit per code, Scan next, lookup, errors).
- **Integration:** [`check-in.integration.test.ts`](../src/features/admin/check-in.integration.test.ts)
  against the local database: a second scan returns the first time,
  simultaneous scans record one check-in, un-check then scan again, an edited
  code, and another event's ticket.
- **By hand, on real phones:** iOS Safari and Android Chrome scanning a live
  ticket, a screenshot, and a ticket on a dim screen; double scan; wrong event;
  blocked camera; manual lookup.

### Trial with real people

Run it on a preview deploy, using a draft event (see "Drafts for admins" in
[`event-states.md`](event-states.md)). Only admins and managers can see a draft,
so testers need one of those roles. Execs work, or give testers the manager role
for the trial and remove it afterwards.

Before the trial:

- Preview shares the production database. The scanner needs no migration.
- Check which Square credentials Preview uses. If they're production, every
  registration is a real charge. Every ticket goes through Square today, and
  there is no free-registration path yet.
- Give testers the branch's alias URL, so everyone stays on one build across
  pushes. Turn off Vercel Deployment Protection for the trial, or share a
  bypass link, so testers don't need Vercel access.

Afterwards, leave the event in Draft, or delete it and its tickets.

## Open questions

- Free events: there is no free-ticket path yet, so how does a free attendee
  get a ticket and a code? (Proposed schema assumption 3.)
- Do we need an "undo check-in" on the result card for a mis-scan?
