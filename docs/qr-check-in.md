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
  shows the event, the holder, and a placeholder QR. Its badge is one of the
  student-facing badges in `docs/event-states.md`. A code shows for Going and
  Checked in. Build its `event` prop with
  [`toTicketEvent`](../src/features/events/lib/ticket.ts).
- **Check-in data:** `check_in_sessions` (one or more per event) and
  `check_ins` (one row per registration per session, unique on that pair).
  `/admin/events/[event]/check-in` already lists attending registrations with a
  search box and a per-session check-in toggle (`toggleCheckInAction`).

## Why a signed token

Registration IDs show up in admin URLs, so a QR code holding the bare ID would
let anyone make a working ticket. The signature proves the server issued it.

The token never expires or changes, so a screenshot scans as well as the live
page. Reuse is stopped at the door: the second scan finds the existing
`check_ins` row and shows "Already checked in at 10:02".

**Open:** [`schema-proposed.sql`](./schema-proposed.sql) gives the planned
`event_tickets` table a random `qr_token` column instead. Both work. If that
migration lands this term, pick one with the schema owner: either keep the
signature (and drop `qr_token`) or use `qr_token` (and delete
`check-in-token.ts`). Signing over a ticket ID works the same as over a
registration ID.

## Who gets a ticket

A registration with `attending = true`, the same set the check-in table lists.
Paid fulfillment sets this along with `status = 'accepted'`. The states doc
says a registered person stays registered, so the ticket has no cancelled state.

## Build steps

### 1. Real QR on the ticket

- The portal event page (server component) loads the viewer's registration,
  calls `createCheckInToken(registration.id)`, and passes the token to
  `EventTicket` as a new `qrToken` prop. The token is fine to send to the
  browser; only the secret is not.
- Render the QR as an SVG on the server with the `qrcode` package, so no QR
  library ships to the client. Use error correction level M and a quiet zone,
  and keep it at least 192 px so it scans off a dim screen.
- Show the ticket only to its owner; the page already runs `requireAuth()`.

### 2. Check-in by token

A server action, `checkInByTokenAction(eventId, sessionId, token)`:

1. `requireAdmin()`.
2. `verifyCheckInToken(token)` → registration ID, or "Not a UX Hub ticket".
3. Load the registration and holder name. Reject if it belongs to another event
   ("Ticket is for a different event") or is not attending ("Ticket cancelled").
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

- **Unit:** token round-trip and tampering (done); the action's result for each
  outcome with Supabase mocked; result-card copy.
- **SQL:** the check-in function in `supabase/tests/rls.sql`: a second call
  returns the first timestamp, and a non-admin can't call it.
- **By hand, on real phones:** iOS Safari and Android Chrome scanning a live
  ticket, a screenshot, and a ticket on a dim screen; double scan; wrong event;
  manual lookup.

## Open questions

- `qr_token` column or signed token (see above).
- Should managers, not just admins, be able to scan?
- Free events: do they create an attending registration today, so every attendee
  has a code? (Proposed schema assumption 3.)
- Do we need an "undo check-in" on the result card for a mis-scan?
