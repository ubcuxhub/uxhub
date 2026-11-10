# UBC email verification for student and faculty memberships

Status: accepted v2 · 2026-11-10 · blocking code verification, implemented in
one PR (see [Implementation notes](#implementation-notes))

Builds on `main` after #259 (setup `user_type`, `user_type_confirmed_at`) and
#260. Replaces v1 (email link, non-blocking): the link, the token module, the
Confirm page, `UBC_EMAIL_TOKEN_SECRET` and the portal "confirm your email"
notice are gone.

## Decisions

1. **Blocking, with a 6-digit code.** At the join details step
   (`/portal/membership/join/student|faculty`) a UBC student or faculty member
   enters a UBC address. We email a 6-digit code to it, and they type the code
   into the same dialog step. Only then does the flow continue to tiers and
   payment. Nobody pays a UBC tier unverified, and the server refuses the
   charge too (see [Payment guard](#payment-guard)).
2. **Domains.** Students use `@student.ubc.ca` exactly. Faculty use `@ubc.ca`
   or any `*.ubc.ca` subdomain (`cs.ubc.ca`, `sauder.ubc.ca`), except
   `student.ubc.ca`, `alumni.ubc.ca` and their subdomains. Faculty no longer
   have to sign in with their UBC address: today's "must equal sign-in email"
   rule in `saveMembershipProfileAction` and `updateEligibilityProfileAction`
   goes. They prove the address with a code instead.
3. **No code when the sign-in email already proves it.** If the member's sign-in
   email is confirmed (`supabase.auth.getUser()`, `email_confirmed_at`) and
   qualifies for their audience, the field is pre-filled and locked with a
   "Verified" chip, saving stamps the verification, and no email is sent. Read
   the sign-in address from auth, not `user_info.email`, which isn't kept in
   sync.
4. **Escape hatch.** "Resend code" unlocks 60 seconds after each send, up to 5
   sends per rolling 24 hours. A standing "Can't get the code?" note says to
   contact a UX Hub exec, who verifies them in admin. Manual verification stays
   and satisfies the requirement.
5. **Existing members see nothing.** Every student or faculty member holding an
   active or pending membership when the migration runs is recorded as
   verified (`grandfathered`), with or without a UBC address on file. They get
   no prompt, banner or email. Grandfathering lasts until their current
   membership ends. Since nobody can buy while a membership is active or
   pending, this means it never covers a purchase: the next purchase or renewal
   asks for a code. Confirmed; see [Resolved](#resolved) 1.
6. **365-day validity.** A `code`, `sign_in_email` or `manual` verification
   counts for 365 days, matching the membership year. After that, the next
   purchase asks again. Members whose sign-in email qualifies are re-verified
   automatically on save.
7. **One verified account per address.** A partial unique index on `ubc_email`
   among verified, live rows stops a friend from reusing someone else's inbox.
8. **Student number.** The member-side check exists (`validateStudentNumber`:
   8 digits, no obvious fakes). Close the gap in the admin edit path
   (`src/features/admin/lib/user-edit.ts` accepts any digits) by reusing it.
   The number is never proof of anything. There's no DB check constraint:
   existing rows may violate it, and an invalid row would then fail every
   update.

## The flow

Details form → Next → save the profile and the UBC address. If the address is
the confirmed sign-in email, stamp it and continue. Otherwise send a code →
show the code field in the same step → correct code stamps the verification →
continue to `/portal/membership` (tiers, then checkout) exactly as today.

- No new route. The code state lives inside `MembershipDetailsForm`, which both
  the canonical `(shell)` page and the `@flow` intercepted page already render
  through `MembershipDetailsRoute`, so the two trees stay in step for free.
- It survives a refresh or reopening the dialog. `MembershipDetailsRoute` loads
  any live code for the saved address (`sentAt`, `expiresAt`, `resendAt`,
  `attemptsLeft`, never the hash) and opens in the code state.
- `MembershipPlansRoute` already redirects an incomplete profile to the details
  step. It now does the same for a UBC-type member without a purchase-valid
  verification. `MembershipCheckoutRoute` reaches the same place through
  `isEligibleForMembership`. A deep link to checkout therefore ends up at the
  code step.

## Data model

One additive migration, `supabase migration new add_ubc_verification`. Its
timestamp must sort after `20261110041028`; regenerate it if another migration
lands first.

### `user_info`: the verified state

The guard and UI already load this row, and members may read their own.

- `create type public.ubc_verification_method as enum ('code', 'sign_in_email', 'manual', 'grandfathered')`
- `ubc_email text`: the profile's UBC address, verified or not. Check
  `ubc_email = lower(btrim(ubc_email))`.
- `ubc_verified_at timestamptz`
- `ubc_verified_via public.ubc_verification_method`
- `ubc_verified_by uuid references user_info(id) on delete set null`: the
  manager, for `manual` only.
- Checks:
  - `(ubc_verified_at is null) = (ubc_verified_via is null)`
  - `ubc_verified_via not in ('code', 'sign_in_email') or ubc_email is not null`
  - `ubc_verified_by is null or ubc_verified_via = 'manual'`
- So a verified state can exist without an address (`manual`,
  `grandfathered`).
- No `authenticated` UPDATE grant. `user_info` uses column grants, so new
  columns aren't member-writable. Every write goes through the service role.
- Trigger `scrub_ubc_verification` (before update) clears the three
  `ubc_verified_*` columns in these cases, unless the same update writes
  `ubc_verified_at` (otherwise the sign-in auto-stamp on save would be wiped):
  - `user_type` changes (any method)
  - `ubc_email` changes (`code`, `sign_in_email`)
  - `student_number` changes (`manual`, mirroring
    `scrub_user_student_verification`)
  - `deleted_at` is set: also nulls `ubc_email`
- After the backfill:
  `create unique index user_info_ubc_email_verified_key on public.user_info (ubc_email) where ubc_verified_at is not null and ubc_email is not null and deleted_at is null;`

### `ubc_verification_codes`: the pending code

A new table, not columns.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` PK | references `user_info(id)` on delete cascade; one live code per member |
| `email` | `text not null` | the address the code was sent to, lowercase |
| `code_hash` | `bytea` | null once used |
| `code_salt` | `bytea` | 16 random bytes per send |
| `expires_at` | `timestamptz` | send time + 10 minutes |
| `attempts` | `smallint not null default 0` | reset on each send |
| `last_sent_at` | `timestamptz not null` | for the 60-second cooldown |
| `window_started_at` | `timestamptz not null` | for the rolling 24-hour cap |
| `sends_in_window` | `smallint not null default 0` | |

- RLS enabled with no policies. `revoke all from anon, authenticated`. Add it to
  `TABLES` (`ubcVerificationCodes`) and to the Table → helper map in
  `supabase/README.md`.
- An after-update trigger on `user_info` deletes the member's row when
  `deleted_at` is set (the row is anonymized, not deleted, so the cascade never
  fires).
- On success the code fields are nulled but the row stays, so the send
  counters survive.

**Why a table:**

- Members read their own `user_info` with `select *`. A hash of a 6-digit code
  there could be brute-forced in milliseconds by the member, which would
  defeat the check without opening the inbox.
- Revoking column SELECT would break every `select *`.
- A service-role-only table makes the boundary explicit, and RLS tests can
  check it.
- It keeps short-lived, high-churn writes off the hot `user_info` row and its
  `updated_at` and guard triggers.

### RPCs

All three are `security definer` with `set search_path = public`,
`revoke all from public, anon, authenticated` and
`grant execute to service_role`. Each one starts by locking the member's
`user_info` row (`for update`), which serializes everything per member,
including the first send, when no code row exists yet.

- **`claim_ubc_code_send(p_user, p_email, p_code_hash, p_salt)`**
  - Returns `(result, resend_at, expires_at)`. `result` is one of
    `ok | cooldown | daily_cap | taken | already_verified | mismatch`.
  - Refuses (`mismatch`) unless `p_email` equals the row's current
    `ubc_email`.
  - Refuses `already_verified` when that address is currently verified on
    this account.
  - Refuses `taken` when it is verified on another live account within 365
    days.
  - Enforces the 60-second cooldown and the 5-per-24-hours cap. The window
    resets when `window_started_at` is over 24 hours old. Cooldown and cap
    are per member, not per address, so switching addresses can't bypass
    them.
  - Upserts the code row: new address, hash, salt, `expires_at`,
    `attempts = 0`. Any earlier code dies at that moment.
- **`begin_ubc_code_attempt(p_user, p_email)`**
  - Returns `(result, challenge_sent_at, code_hash, code_salt)`. `result` is
    one of `ok | none | stale | expired | locked`.
  - `stale` means the row's `email` differs from `p_email`, the member's
    current `ubc_email`.
  - On `ok`, increments `attempts` before returning. The count is atomic under
    the lock, so parallel guesses can't exceed 5.
  - Once `attempts` reaches 5, it returns `locked` until a new send.
- **`complete_ubc_code_verification(p_user, p_email, p_challenge_sent_at)`**
  - Returns `verified | already_verified | stale | taken`.
  - Requires the code row to be the same send (`last_sent_at` matches) for the
    same address, so a code from a superseded send can't complete.
  - Releases another account's hold on the address if that verification is
    over 365 days old (clears its stamp).
  - Then sets `ubc_verified_at = now()`, `ubc_verified_via = 'code'`, and nulls
    the code fields.
  - A unique violation maps to `taken`.
  - A second call for an address already verified by code returns
    `already_verified`.
- **`grandfather_ubc_members()`**
  - Returns the count of rows it stamped.
  - It's the grandfathering rule below, as a function, so integration tests can
    exercise it and PR 2's migration can rerun it.
  - It's dropped in the cleanup migration.

### Backfill

Disable `update_user_info_updated_at` around it, as #259 does. Steps, in
order, on live rows (`deleted_at is null`):

1. **Faculty address.** `ubc_email = lower(faculty_email)` for faculty rows
   whose `faculty_email` passes the faculty domain rule. Skip an address
   another row already took; the earliest row wins.
2. **Sign-in email.**
   - Join `auth.users` on `auth_user_id` where `email_confirmed_at is not null`.
   - Covers students whose sign-in email is `@student.ubc.ca`, and faculty
     whose sign-in email passes the faculty rule.
   - Sets `ubc_email = lower(email)`, `ubc_verified_at = now()`,
     `via = 'sign_in_email'`.
   - Auth emails are unique, so this step can't produce two verified rows with
     the same address.
3. **Manual.** Rows still unverified with `student_verified_at` set: copy the
   timestamp and `student_verified_by` with `via = 'manual'`.
4. **Grandfathered** (`grandfather_ubc_members()`).
   - Applies to rows still unverified where `user_type in ('ubcStudent', 'faculty')`.
   - The member must have a pending membership
     (`membership_pre_ordered_type_id is not null`) or an active one:
     `membership_type_id is not null` and
     `coalesce(least(membership_expires_at, app_settings.membership_term_ends_at), 'infinity') > now()`.
     That mirrors `hasActiveMembership`.
   - Sets `ubc_verified_at = now()`, `via = 'grandfathered'`, and leaves
     `ubc_email` as found (usually null).
5. **Clear shared addresses.** Null `ubc_email` on any `manual` or
   `grandfathered` row whose address another verified row also holds, so the
   index can't fail the deploy.
6. Create the unique index.

### Backward compatibility

- Columns are nullable, the table and enum are new, and production code
  ignores all of them. The old code keeps working while the build runs.
- `faculty_email` stays and is written with the same value as `ubc_email` for
  faculty, because production code reads it for profile completeness.
- `student_verified_at` and `student_verified_by` stay and are written
  alongside `manual` stamps for the same reason.
- A later cleanup migration (after a term) drops both, plus
  `grandfather_ubc_members()`.
- Regenerate `database.types.ts`.
- New helper `src/lib/supabase-helpers/ubc-verification.ts` (server-only)
  wraps the RPCs and the code-row read for `MembershipDetailsRoute`.

## Codes

Module `src/features/memberships/lib/ubc-code.ts` (server-only).

| Rule | Value |
| --- | --- |
| Format | 6 digits, `crypto.randomInt(0, 1_000_000)` zero-padded |
| Lifetime | 10 minutes |
| Wrong attempts per code | 5, then `locked` until a resend |
| Resend cooldown | 60 seconds, per member |
| Sends | 5 per rolling 24 hours, per member |
| Binding | the member and the address (in the hash and the row) |

- **Hash.** `sha256(salt ‖ user_id ‖ ":" ‖ email ‖ ":" ‖ code)`. No pepper, so
  no secret. The only reader of the table is the service role, which can
  already set `ubc_verified_at` directly, so a pepper would protect nothing.
  The hash exists to keep the code out of the database, backups and logs in
  plaintext.
- **Compare.** `begin_ubc_code_attempt` counts the attempt and hands back the
  hash and salt. Node recomputes the hash and compares with
  `crypto.timingSafeEqual`, then calls `complete_ubc_code_verification`. The
  comparison never happens in SQL, where `=` isn't constant-time.
- **Brute force.** At most 25 guesses per account per day (5 sends × 5 tries),
  about 1 in 40,000 per day. Accounts need a confirmed email, and admins can
  see who verified.
- **Input.** The server action rejects anything but `^\d{6}$` (after stripping
  spaces and dashes) before touching the database, so a malformed entry costs
  no attempt.

### Edge cases

- **Address changes mid-flow.** The send and verify actions always use the
  saved `ubc_email`, never a client-supplied one. Changing the address means
  going back to the form ("Change email") and saving again. The next send
  replaces the row, so the old code is dead. A code submitted against the old
  address gets `stale`, and the UI returns to the form. The per-member
  cooldown still applies, so a send to the new address may show the countdown.
- **Two tabs, two sends.** The row lock lets one win; the other gets
  `cooldown`. When a live code exists for the same address, the UI treats
  `cooldown` as "code sent".
- **Two tabs, same correct code.** Both attempts count, both compare equal.
  The first `complete` stamps, the second returns `already_verified`, and both
  continue.
- **Resend while a verify is in flight.** `complete` checks `last_sent_at`, so
  a code from the superseded send returns `stale`: "We sent a newer code".

## Server actions

All in `src/features/memberships/actions.ts`. The pure helpers go in
`lib/ubc-verification.ts`.

### Pure helpers

- **`validateUbcEmail(email, audience)`**
  - Normalizes the address.
  - Replaces `validateFacultyEmail`'s `*.ubc.ca` regex with the domain rules
    in Decision 2.
  - Rejects lookalikes such as `ubc.ca.evil.com` and `evilubc.ca`.
- **`ubcVerificationStatus(user, { now, termEndsAt })`** returns one of:
  - `{ state: "verified", via, at }`: `code`, `sign_in_email` or `manual`
    within 365 days, or `grandfathered` while
    `hasActiveOrPendingMembership(user, termEndsAt)`
  - `{ state: "expired", via, at }`
  - `{ state: "unverified" }`
  - `{ state: "n/a" }` for `nonUbc`
- **`hasPurchaseUbcVerification(user, now)`**
  - `nonUbc` → true.
  - Otherwise `via ∈ {code, sign_in_email, manual}` and `at` within 365 days.
  - `grandfathered` never qualifies, which is how Decision 5 is enforced.
- **`UBC_VERIFICATION_TTL_DAYS = 365`**

### Actions

- **`saveMembershipProfileAction`**
  - Student and faculty input gains `ubcEmail`. Students get a new field;
    faculty's existing field is relabelled.
  - Validates the domain, then writes the profile and `ubc_email` (plus
    `faculty_email` for faculty).
  - If the address equals the confirmed sign-in email, the same update stamps
    `via = 'sign_in_email'`. A unique violation returns "This UBC email is
    already verified on another account. Contact a UX Hub exec."
  - If the address is already purchase-verified on this account, nothing more
    happens.
  - Otherwise it calls `claim_ubc_code_send` and emails the code.
  - Returns `{ ok: true, verification: "verified" } | { ok: true, verification: "code", send: SendResult }`.
    A failed send never fails the save; the form shows the send state.
- **`sendUbcCodeAction()`** (Resend). Same claim and send, for the saved
  address. Returns `SendResult`, one of:
  - `sent` (with `resendAt` and `expiresAt`)
  - `cooldown` (with `resendAt`)
  - `daily_cap`
  - `taken`
  - `already_verified`
  - `send_failed`
- **`verifyUbcCodeAction(code)`**
  - Format check, `begin_ubc_code_attempt`, compare, then
    `complete_ubc_code_verification`.
  - Returns `verified`, `wrong` (with `attemptsLeft`), `expired`, `locked`,
    `stale`, `taken` or `none`.
  - Revalidates `/portal/membership` and `/admin/users`.

### Other changes

- **Sign-in email.** `loadCurrentUser` already calls `getUser()`. Add
  `confirmedEmail` (the email when `email_confirmed_at` is set, else null) to
  its cached result, plus a `getConfirmedSignInEmail()` reader. That's no
  extra auth round trip.
- **`buildEligibilityUpdate`.** Both UBC types own `ubc_email`; Non-UBC clears
  it.
- **`isMembershipProfileComplete`.** UBC types additionally need a valid
  `ubc_email`.
- **`isEligibleForMembership`** adds `hasPurchaseUbcVerification`. That's the
  single rule the plans route, the checkout route and the payment action share.

## Payment guard

- **Location:** `createSquarePaymentForMembership` in
  `src/features/payments/fulfillment.ts`, reached from `submitCheckoutAction`.
  - The `user` there comes from `requireAuth()` in the same request, so the
    stamp is read fresh.
  - The check runs before `fetchNonterminalMembershipPurchase`,
    `ensureSquareCustomerId`, `createPurchase` and the Square call, so no
    purchase row or charge exists for an unverified member.
- **Two layers:**
  1. An explicit `hasPurchaseUbcVerification(user)` check first. It returns
     `{ error: "Verify your UBC email before paying.", terminal: true }` and
     logs `payment.membership_ubc_unverified` (warn).
  2. `isEligibleForMembership` includes the same rule, so the UI and the server
     can't drift.
- **Fulfilment (webhook) doesn't recheck.** The money is already taken by
  then, and refusing would strand a captured payment. The charge-time check is
  the authoritative one.
- **Admins** assigning a tier in admin aren't gated. They're trusted, and that
  is the escape hatch's other half.

## Email

- `renderUbcVerificationCodeEmail({ code })` in `src/lib/email/templates.ts`,
  built on `renderEmailLayout`.
- Subject "Your UX Hub verification code". The code stays out of the subject
  so it doesn't land in notification previews and mail logs.
- **Body:**
  - "Use this code to verify your UBC email for UX Hub"
  - the code large, monospace and letter-spaced, as plain text so mail clients
    and iOS can offer it for autofill
  - "It expires in 10 minutes."
  - "If you didn't request this, ignore this email. Someone may have typed
    your address by mistake. UX Hub will never ask you for this code."
- Sent with `sendEmail` to the UBC address.
- **Without `RESEND_API_KEY`:** `sendEmail` returns false.
  - When `NODE_ENV !== "production"`, log `ubc_verification.dev_code` with the
    code, so local testing works. This is the one place a code is logged.
  - In production, treat it as `send_failed` and log at error.

## Dialog UX

States of the details step for UBC audiences:

| State | What shows |
| --- | --- |
| Enter address | "UBC student email" / "UBC faculty email" field with the domain hint. If the sign-in email qualifies: pre-filled, read-only, "Verified" chip, and Next continues without a code |
| Code sent | "We sent a 6-digit code to jane@student.ubc.ca. Check Junk too." Code field, Verify button, "Change email", Resend with countdown |
| Wrong code | "That code isn't right. 3 tries left." Field keeps focus, contents selected |
| Expired | "This code has expired." Primary action becomes "Send a new code" |
| Too many attempts | "Too many tries. Send a new code." Field disabled |
| Resend cooldown | "Resend code in 0:42" (disabled), reusing `getRemainingCooldownSeconds` from `src/features/auth/resend-email-cooldown.ts` |
| Daily cap | "You've requested too many codes today. Try again tomorrow, or contact a UX Hub exec." |
| Taken | "This UBC email is already verified on another UX Hub account. Contact a UX Hub exec." |
| Send failed | "We couldn't send the code. Try again." Resend is enabled |
| Verified | "Verified" check, then the existing navigation to `/portal/membership` |

"Can't get the code? Contact a UX Hub exec and they can verify you." shows
under the field in every code state.

**Input:**

- One `Input`, not six boxes, for robustness and screen-reader sanity:
  `inputMode="numeric"`, `autoComplete="one-time-code"`, `pattern="[0-9]*"`,
  `maxLength={6}` after normalization.
- Paste or autofill strips non-digits, so "123 456" and "Code: 123456" both
  work.
- Submits automatically at 6 digits, and on Enter or Verify.

**Focus and announcements:**

- Focus moves to the code field when the code state opens, and back to the
  address field on "Change email".
- A polite `role="status"` live region announces "Code sent", the
  tries-left message, "Code expired" and "Verified".
- Errors use `aria-invalid` and `aria-describedby`.
- The countdown isn't announced each second, only when Resend becomes
  available.

**Busy state:** `setBusy` from `useFlowDialog` while sending or verifying, as
the save does today.

## Settings

- Settings › Profile shows the UBC email with its status, and only when one is
  on file. Grandfathered members without one see nothing new.
- While no membership is active, `updateEligibilityProfileAction` may change it
  (validated by domain). The trigger clears the verification, unless the new
  address is the confirmed sign-in email, which is stamped.
- Settings never sends codes; the next join asks.

## Admin

**`AdminUserRecord`:**

- The title `BadgeCheck` follows `ubcVerificationStatus` (`verified`).
- The "Verification" field reads one of:
  - "Verified by code · jane@student.ubc.ca · Oct 3"
  - "Verified by sign-in email · …"
  - "Verified manually · Oct 3 · by Iris"
  - "Grandfathered · until membership ends"
  - "Expired · Oct 3, 2025"
  - "Code sent · not entered"
  - "Not verified"
- `ubc_email` is shown read-only.

**Manual verification:**

- The checkbox becomes "Verified" and reflects any current method.
- `setStudentVerificationAction` checking it stamps `via = 'manual'`,
  `by = manager`, plus the legacy columns.
- Unchecking it clears the verification whatever the method.

**`AdminUsersManager`:**

- A `ChipFilterSection` "UBC verification" for UBC-type users: Verified,
  Grandfathered, Expired, Not verified.
- `fetchAdminUserRecords` already selects `*`.
- The "Code sent" state needs the code row, so read it with the service role
  for the single record only.

## Logging

Use `log` from `@/lib/log`. Never log the code (except the dev line above),
the hash, or any address.

| Event | Level | Fields |
| --- | --- | --- |
| `ubc_verification.code_sent` | info | `userId`, `audience` |
| `ubc_verification.send_refused` | warn | `userId`, `reason`: `cooldown \| daily_cap \| taken \| already_verified \| mismatch` |
| `ubc_verification.code_rejected` | warn | `userId`, `reason`: `wrong \| expired \| locked \| stale \| none \| malformed` |
| `ubc_verification.verified` | info | `userId`, `via` |
| `ubc_verification.manual_set` | info | `userId`, `managerId`, `verified` |
| `ubc_verification.send_failed`, `.verify_failed` | error | `errorFields` |
| `payment.membership_ubc_unverified` | warn | `userId`, `membershipTypeId` |

## Environment

There are no new env vars: the code is random and stored hashed, not a signed
token. `RESEND_API_KEY` and `EMAIL_FROM` are already required for receipts.

## Tests

**Unit:**

- `validateUbcEmail`:
  - students accepted only on `student.ubc.ca`
  - faculty accepted on `ubc.ca`, `cs.ubc.ca` and `sauder.ubc.ca`
  - rejected: `student.`, `alumni.`, `x.student.ubc.ca`, `ubc.ca.evil.com`,
    `evilubc.ca`
  - case and whitespace normalized
- `ubc-code`:
  - always 6 digits
  - the hash binds user, email and salt
  - the compare rejects length mismatch
- `ubcVerificationStatus` and `hasPurchaseUbcVerification`:
  - the 365-day boundary
  - grandfathered shows verified while the membership lasts, expired after,
    and never passes the purchase check
  - `nonUbc` is n/a
- `isEligibleForMembership`, `isMembershipProfileComplete` and
  `buildEligibilityUpdate` with the new columns.
- Actions:
  - sign-in auto-stamp only when the email is confirmed and matches the
    audience
  - each send and verify result mapped
  - the dev code is logged only when no key is set and `NODE_ENV` isn't
    production
  - log calls never contain the code or the address
- `fulfillment.test.ts`: an unverified student gets a terminal error, and
  neither `createPurchase` nor Square is called.
- The email template renders the code and expiry, and escapes.
- Admin `user-edit` rejects a non-8-digit student number.
- Components:
  - every dialog state
  - the countdown (fake timers)
  - paste normalization
  - the `autocomplete` attribute
  - focus moves
  - live region text
  - the locked "Verified" field
  - the admin record lines and the users filter

**Integration** (`*.integration.test.ts`, local Supabase):

- Sends:
  - two concurrent sends: exactly one `ok`, the other `cooldown`
  - the sixth send in 24 hours hits `daily_cap`
  - the cooldown lifts after 60 seconds (backdate `last_sent_at`)
  - `taken` for an address verified on another live account
- Attempts:
  - 5 wrong attempts, then `locked`
  - 8 concurrent attempts produce exactly 5 `ok` begins
- Completion:
  - `complete` stamps
  - a repeat returns `already_verified`
  - a superseded send and a changed address both return `stale`
  - a holder verified over 365 days ago is released
- The unique index blocks a second account.
- The trigger:
  - clears on `ubc_email`, `user_type` and `student_number` (manual) changes
  - on deletion, also removes the code row
  - keeps a stamp written in the same update as the address
- `grandfather_ubc_members()`:
  - stamps active and pending UBC members, with or without an address
  - skips lapsed members, Non-UBC members and already-verified rows
- Payment guard: `executeCheckoutForUser` for an unverified student (Square
  mocked, as in `fulfillment.integration.test.ts`) returns a terminal error
  and creates no `purchases` row. A code-verified student succeeds.
- Seed and fixtures:
  - seeded student members are `grandfathered`
  - faculty are `sign_in_email`
  - `no-membership@example.com` is unverified, so the code flow is testable
    locally through the dev log
  - `src/test/integration.ts` fixtures gain the new columns

**RLS (`supabase/tests/rls.sql`):**

- `authenticated` can't update any `ubc_*` column on their own row, and can
  read their own but not others'.
- `anon` and `authenticated` can't select, insert, update or delete
  `ubc_verification_codes`.
- Neither can execute any of the four functions.

## PR breakdown

Planned as two PRs, about 2,300 lines in total, roughly half of it tests. It
shipped as one (PR 1 and 2 together), so there is no window between the two
deploys and no second migration rerunning `grandfather_ubc_members()`.

| PR | Contents | Lines |
| --- | --- | --- |
| 1. Schema and admin (additive, safe alone) | Migration (enum, columns, table, RPCs, triggers, backfill, index), types, helper, `TABLES`, status lib, admin status, method, badge and filter, manual action writing the new columns, admin student-number check, RLS and integration tests | ~1,000 |
| 2. Blocking member flow | `validateUbcEmail`, code module, actions, email template, `loadCurrentUser` sign-in email, details-form code states, plans and checkout redirects, payment guard, Settings field, seed, unit, component and integration tests, plus a one-line migration rerunning `grandfather_ubc_members()` so members who joined between the two deploys are covered | ~1,300 |
| 3. Cleanup (after a term) | Drop `faculty_email`, `student_verified_*`, `grandfather_ubc_members()` | ~60 |

The behaviour change ships with the merge. Merge it when exec contacts know
about the "Can't get the code?" path. Keep each migration's timestamp the
newest on `main`.

## Resolved

1. **How long does grandfathering last?** Until the member's current
   membership ends, and it never covers a new purchase: their next purchase or
   renewal asks for a code.
   - "Current membership" is whatever is active or pending, read the way
     `hasActiveOrPendingMembership` reads it (`expiry.ts`): a pre-order, or a
     held tier whose effective expiry (the earlier of `membership_expires_at`
     and the club-wide `membership_term_ends_at`) is unset or in the future.
     A member pending at migration time is grandfathered through the
     membership that pre-order becomes.
   - `ubcVerificationStatus` shows `grandfathered` as verified only while that
     holds, and expired after. `hasPurchaseUbcVerification` never accepts it,
     and nobody can buy while a membership is active or pending, so the two
     agree: the stamp can't carry into a purchase.
   - The 365-days-from-migration alternative was rejected.
2. **Is a per-member send cap enough?** Yes, for now: 5 sends per rolling 24
   hours and the 60-second cooldown are per member, with no per-address send
   log. Someone typing a victim's address from several accounts can send at
   most 5 emails a day from each, and every account needs a confirmed email.
   Revisit with a send-log table if abuse shows up.

## Implementation notes

Where the code differs from, or settles details the plan left open:

- **Cap before cooldown.** `claim_ubc_code_send` answers `daily_cap` once five
  sends are used, even inside the 60 seconds after the fifth, since a
  countdown would only lead to the cap.
- **Attempts left.** `begin_ubc_code_attempt` also returns `attempts_left`, so
  "That code isn't right. 3 tries left." needs no extra read. A wrong fifth
  guess answers `locked` straight away.
- **Verify results** add `malformed` (refused before an attempt is counted)
  and `error` (the database failed) to the list above.
- **Address rule in SQL.** The backfill uses `public.ubc_email_qualifies`, the
  same domain rule as `validateUbcEmail`; it is service-role only.
- **Settings** shows the UBC email read-only with its status, for students and
  faculty who have one; it replaces the "Faculty email" field. The address
  changes in the join flow. `updateEligibilityProfileAction` still accepts
  `ubcEmail` (validated by domain), keeps a saved address across a type change
  only while it qualifies, fills an empty one from a qualifying confirmed
  sign-in email and stamps that.
- **Manual verification** checks for another verified account holding the
  same address first and says so, instead of failing on the index. It also
  writes the legacy `student_verified_*` columns for faculty.
- **Changing a student number in admin** unticks "Verified" only for a manual
  verification, matching the trigger; a code or sign-in stamp doesn't depend
  on the number.
- **Admin record line** for a waiting code reads "Code sent Nov 10 · not
  entered", and Non-UBC members read "Not needed for Non-UBC members".
