# QR check-in

Plan for the Event tickets epic: a 2D ticket with a QR code on the portal event
page, a phone scanner for admins at the door, and a manual lookup for codes that
won't scan. Target: Nov 12, 2026.

## What exists

- **Signed token:** [`check-in-token.ts`](../src/lib/check-in-token.ts) turns a
  registration ID into `<registration id>.<signature>` and checks a scanned one.
  The signature is an HMAC made with `CHECK_IN_TOKEN_SECRET`, which never
  leaves the server.
- **Ticket:** [`EventTicket`](../src/features/events/components/EventTicket.tsx)
  shows the event, the holder, and the check-in QR code. Its badge is one of
  the student-facing badges in `docs/event-states.md`. The code shows for Going
  and Checked in, drawn from the `qrToken` prop. Build its `event` prop with
  [`toTicketEvent`](../src/features/events/lib/ticket.ts).
- **Check-in data:** `check_in_sessions` (one or more per event) and
  `check_ins` (one row per registration per session, unique on that pair).
  `/admin/events/[event]/check-in` already lists attending registrations with a
  search box and a per-session check-in toggle (`toggleCheckInAction`).

## Which token

IDs show up in admin URLs, so a QR code holding a bare ID would let anyone make
a working ticket. The code has to hold something only the server could issue.

The token never expires or changes, so a screenshot scans as well as the live
page. Reuse is stopped at the door: the second scan finds the existing
`check_ins` row and shows "Already checked in at 10:02".

**Decided (2026-10-23): use `qr_token`.** `event_tickets` (see
[registration-rollout.md](registration-rollout.md)) gives every ticket a unique
random `qr_token`, and check-in moves from registrations to tickets. The signed
token is being replaced because:

- it signs a registration ID, and `event_registrations` is being retired;
- a per-ticket secret can be revoked by regenerating that one token, without
  rotating `CHECK_IN_TOKEN_SECRET` and invalidating every ticket;
- 32 hex characters make a smaller QR code than an ID plus a signature;
- there is no secret to set per environment.

A scan looks the token up together with the event being scanned, so a valid
ticket for another event is rejected. Once check-in uses `qr_token`, delete
`check-in-token.ts` and its tests and remove `CHECK_IN_TOKEN_SECRET`.
`EventTicket` draws whichever string it gets, so it doesn't change.

## Who gets a ticket

A registration with `attending = true`, the same set the check-in table lists.
Paid fulfillment sets this along with `status = 'accepted'`. The states doc
says a registered person stays registered, so the ticket has no cancelled state.

## Build steps

### 1. Real QR on the ticket (done)

- `EventTicket` draws `qrToken` as an SVG with
  [`toQrSvg`](../src/features/events/lib/qr-code.ts): error correction level
  M, a four-module quiet zone, 192 px, black on white in both themes.
- The page that places the ticket loads the viewer's ticket in a server
  component and passes its token as `qrToken`. The token is fine to send to the
  browser; only a signing secret would not be. This waits on step 2 of
  [registration-rollout.md](registration-rollout.md), since until then nothing
  writes `event_tickets`.
- Render `EventTicket` from a server component where possible, so the `qrcode`
  package stays off the client.
- Show the ticket only to its owner; the page already runs `requireAuth()`.

### 2. Check-in by token

A server action, `checkInByTokenAction(eventId, sessionId, token)`:

1. `requireAdmin()`.
2. Look the ticket up by `qr_token`, with its holder's name, or reject with
   "Not a UX Hub ticket".
3. Reject a ticket for another event ("Ticket is for a different event").
4. Record the check-in atomically, so two scanners on the same code can't both
   win. Do it in one Postgres function (`check_in_registration`, matching
   `check_in_by_token` in the proposed schema), as an insert on the unique
   pair that keeps an existing non-null `checked_in_at`. The function returns
   the timestamp and whether this call set it.
5. Return `{ result: "checked_in" | "already_checked_in" | "rejected", name,
   checkedInAt, reason }`.
6. Log `check_in.scanned` / `check_in.rejected` with IDs only.

The existing toggle stores an un-check as `checked_in_at = null`, so treat a
null row as not checked in. Have the toggle call the same function so the two
paths agree.

### 3. Scanner page

`/admin/events/[event]/check-in/scan`, under the existing admin guard.

- **Camera:** `getUserMedia` with the rear camera. Use a library
  (`qr-scanner` or `@zxing/browser`): the built-in `BarcodeDetector` is missing
  on iOS Safari. Camera access needs HTTPS, so test on a phone through a preview
  deploy or ngrok, not `localhost`.
- **Session picker:** default to the session whose time window contains now.
- **Result card:** full-screen and readable at arm's length. Green with the
  name for a fresh check-in, amber with "Already checked in at 10:02", red with
  the reason for a rejection. Pause the camera until the admin taps "Next", so
  one code isn't submitted repeatedly.
- **Phone only:** show the scanner when `(pointer: coarse)` matches and a
  camera exists. On a laptop, show "Open this page on your phone" with a QR
  linking to the page. This is a UX gate, not security; `requireAdmin()` stays
  the access control.

### 4. Manual lookup

A "Can't scan?" button on the scanner opens a name/email search over attending
registrations (reuse the filter in `CheckInManager`). Picking a person calls
the same check-in function with the registration ID; no token is needed,
because the admin is already authorized.

## Testing

- **Unit:** token round-trip and tampering (done); the rendered QR scans back to
  the token (done); the action's result for each outcome with Supabase mocked;
  result-card copy.
- **SQL:** the check-in function in `supabase/tests/rls.sql`: a second call
  returns the first timestamp, and a non-admin can't call it.
- **By hand, on real phones:** iOS Safari and Android Chrome scanning a live
  ticket, a screenshot, and a ticket on a dim screen; double scan; wrong event;
  manual lookup.

### Trial with real people

Run it on a preview deploy, using a draft event (see "Drafts for admins" in
[`event-states.md`](event-states.md)). Only admins and managers can see a draft,
so testers need one of those roles. Execs work, or give testers the manager role
for the trial and remove it afterwards.

Before the trial:

- Preview shares the production database, so push any migration the scanner
  needs (e.g. `check_in_registration`) with `pnpm exec supabase db push` first.
- Check which Square credentials Preview uses. If they're production, every
  registration is a real charge. Every ticket goes through Square today, and
  there is no free-registration path yet.
- Give testers the branch's alias URL, so everyone stays on one build across
  pushes. Turn off Vercel Deployment Protection for the trial, or share a
  bypass link, so testers don't need Vercel access.

Afterwards, leave the event in Draft, or delete it and its registrations.

## Open questions

- Should managers, not just admins, be able to scan?
- Free events: do they create an attending registration today, so every attendee
  has a code? (Proposed schema assumption 3.)
- Do we need an "undo check-in" on the result card for a mis-scan?
