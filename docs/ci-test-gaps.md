# CI test gaps

A review of what CI verifies today and what it leaves untested, ordered by risk.
Reviewed on 2026-09-23 against `main` at `a16266d`. Remove an entry once it is
covered, and archive this doc when the list is empty.

## What CI runs

[`ci.yml`](../.github/workflows/ci.yml) has two jobs, on every pull request and
every push to `main`:

- **verify:** `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test` (50 Vitest
  files colocated under `src/` and `scripts/`).
- **build:** starts a throwaway Supabase with every migration applied, runs
  [`supabase/tests/rls.sql`](../supabase/tests/rls.sql) with `pnpm test:rls`,
  then `pnpm build`.

Pure logic is well covered: request parsing and schemas, membership policy and
expiry, auth guards and redirect paths, email templates, Square webhook parsing
and endpoint configuration, the `fulfillment-rules` helpers, and the seed
`prune` and `targets` libraries. The gaps are in the code that orchestrates
those pieces against Square and the database.

## High risk

### 1. Payment fulfillment is never executed

[`fulfillment.ts`](../src/features/payments/fulfillment.ts) (`executeCheckoutForUser`,
`processSquarePaymentEvent`) is mocked out in
[`payments/actions.test.ts`](../src/features/payments/actions.test.ts). Only its
pure helpers in `fulfillment-rules.ts` are tested. Untested paths:

- A ticket charge is authorized, the seat reservation fails, and the code must
  cancel the Square payment and mark the purchase `canceled`.
- A definitive ticket charge failure must release the reservation and mark the
  purchase `failed`; an ambiguous one must return `processing` and leave both
  alone.
- A retried checkout with the same idempotency key must reconcile against
  `payments.get` and never call `payments.create` a second time.
- A retry whose idempotency key belongs to another user must not reveal that
  purchase.
- A pending membership purchase for the same tier must be reused instead of
  charged again.
- Membership fulfillment must set `membership_expires_at` from the term end,
  set `membership_type_id`, and clear `membership_pre_ordered_type_id`.
- Fulfilling an already-fulfilled purchase must be a no-op, while still
  scheduling the confirmation email.
- A webhook for a payment whose ID was never saved must find the purchase
  through `referenceId`, and only when `matchesReferencedPurchase` agrees.
- A duplicate webhook delivery (`recordSquareWebhookEvent` returns false) must
  change nothing.
- Event tickets must be priced at `member_price` for members and
  `regular_price` otherwise, and refused for events that use applications or
  where the user already has a registration.

**Approach:** unit tests that mock `squareClient`, the purchase, registration,
and user helpers, the `reserve_paid_event_ticket` RPC, and `next/server`'s
`after`, in the same style as `payments/actions.test.ts`.

### 2. The Square webhook route is untested

[`api/square/webhook/route.ts`](../src/app/api/square/webhook/route.ts) is
public-facing and moves purchases to `completed`. Untested:

- A missing signature returns 400, and a bad one returns 403.
- With several `SQUARE_WEBHOOK_ENDPOINTS`, a signature that matches any one of
  them is accepted.
- A non-JSON body, or a JSON array or primitive, returns 400.
- Event types other than `payment.updated` return 200 without processing.
- A payload that fails `parseSquarePaymentUpdatedEvent` returns 400.
- A processing error returns 500, so Square retries the delivery.

**Approach:** call `POST` with a real `Request`, sign bodies with
`WebhooksHelper`, and mock `processSquarePaymentEvent`.

### 3. The seat-reservation and atomic-save functions are never called

`rls.sql` exercises `set_user_role` and no other database function. These are
untested:

- `reserve_paid_event_ticket`: each failure reason (`EVENT_NOT_FOUND`,
  `EVENT_NOT_ACTIVE`, `APPLICATION_REQUIRED`, `REGISTRATION_NOT_OPEN`,
  `REGISTRATION_CLOSED`, `ALREADY_REGISTERED`, `SOLD_OUT`), the capacity count,
  and that a repeat call for the same purchase returns the same registration.
- `release_paid_event_ticket_reservation`: frees the seat it reserved and
  nothing else.
- `save_admin_event_atomically` and `delete_event_atomically`: all-or-nothing
  behavior and the cover-image guard.
- `delete_account` and `event_registration_counts`.

**Execute grants.** Covered.
`20260923120000_restrict_paid_event_ticket_functions.sql` revokes execute on
`reserve_paid_event_ticket` and `release_paid_event_ticket_reservation` from
`public`, `anon`, and `authenticated`, leaving only `service_role`, which is how
`fulfillment.ts` calls them. `rls.sql` asserts that `anon` and `authenticated`
lack execute on both and that `service_role` keeps it, next to the `purchases`
privilege check. The functions' behavior is still untested.

**Approach:** a SQL suite in the style of `rls.sql` (one transaction, rolled
back, scoped fixtures), run as superuser or `service_role` for the behavior
tests.

### 4. Server actions that write through the service role are untested

Service-role writes bypass RLS, and `guard_user_info_privileged_columns` lets
them through because `auth.uid()` is null. The TypeScript checks are the only
gate.

- [`memberships/actions.ts`](../src/features/memberships/actions.ts):
  `saveMembershipProfileAction` and `updateEligibilityProfileAction`. Untested:
  the refusal to change classification while a membership is active or
  pending, student-number, faculty, and year validation, and clearing the
  fields of the classification being left.
- [`admin/actions.ts`](../src/features/admin/actions.ts) has no tests at all.
  The most important check is `assertManagerUserUpdate`, the allowlist that
  keeps `updateManagerUserAction` from writing arbitrary columns such as
  `role_access` or `square_customer_id`. Also untested: the role check in
  `updateUserRoleAction`, the still-referenced check in
  `discardUnusedEventImageAction`, and the save, delete, check-in, term-end, and
  membership-type actions.

**Approach:** unit tests that mock the guards and `admin-server` helpers, as
[`settings/actions.test.ts`](../src/features/settings/actions.test.ts) does.
Assert that a guard redirect propagates and that rejected input never reaches
the write helper.

## Medium risk

### 5. RLS policies with no assertion

- **`purchases`:** only anon's lack of table privileges is checked. Untested:
  a member reads only their own purchases, a member cannot insert or update
  one, an admin reads all, and an admin may delete only failed event-ticket
  purchases, never a completed one.
- **`check_ins`:** only reading `check_in_sessions` is checked. Nothing asserts
  that a non-admin cannot insert, update, or delete a check-in.
- **Admin-only writes:** nothing asserts that a basic user cannot write to
  `events`, `membership_types`, `mentors`, `sponsors`, `event_mentors`,
  `event_sponsors`, or `event_application_questions`.
- **`square_webhook_events`:** nothing asserts that `anon` and `authenticated`
  cannot read or write it.
- **Storage:** `event-images` deliberately has no `storage.objects` policies
  (see [Storage](../supabase/README.md#storage)). Assert that `anon` and
  `authenticated` cannot insert into or delete from the bucket, so a policy
  added later cannot open uploads silently.

### 6. Data-access helpers

Of [`src/lib/supabase-helpers`](../src/lib/supabase-helpers), only
`memberships.ts` has tests. The helpers with logic beyond a single query are:

- `purchases.ts`: `claimPurchaseConfirmationEmail` and
  `releasePurchaseConfirmationEmailClaim`, which keep the confirmation email to
  one send, and the duplicate detection in `recordSquareWebhookEvent`.
- `check-ins.ts`: status aggregation for the check-in manager.
- `admin-server.ts`: `adminDeleteEventImageByUrl`, which must ignore URLs
  outside the bucket.

## Lower risk

### 7. Client hooks and components

Six components have tests. The largest untested client logic is
[`use-event-form.ts`](../src/features/admin/hooks/use-event-form.ts),
`use-event-form-draft.ts`, `use-application-questions.ts`,
`use-unsaved-changes-guard.ts`, and
[`user-context.tsx`](../src/lib/auth/user-context.tsx).

### 8. No end-to-end run or coverage report

Nothing drives the app. Routing, the membership pages duplicated under
`(shell)/portal/membership/*` and `@flow/(.)portal/membership/*`, and a full
checkout are verified only by `next build` compiling. Vitest has no coverage
reporter or threshold configured, so a regression in coverage goes unnoticed.

### 9. Seed and smoke-test scripts

[`reconcile-users.ts`](../scripts/seed/lib/reconcile-users.ts) (about 1,260
lines), `scripts/seed/index.ts`, and `scripts/payment-smoke/supabase-store.ts`
have no tests. `prune`, `targets`, `event-timeline`, `user-fixtures`, and the
payment-smoke service do.

## Suggested order

1. Items 1 and 2: the paths that take money and fulfill it.
2. Item 3, starting with the revoke migration and its assertion.
3. Item 4, starting with `assertManagerUserUpdate`.
4. Item 5, alongside any future RLS change.
