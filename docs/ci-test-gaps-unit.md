# Unit test plan

A suggested plan for the unit-test gaps in CI, reviewed 2026-09-23. Adjust the
order and scope as you go, and delete an item once it is covered. A separate
plan covers the integration gaps in
[`ci-test-gaps-integration.md`](ci-test-gaps-integration.md).

## Background

`pnpm test` runs about 50 Vitest files. Pure logic is well covered: schemas,
membership policy, auth guards, email templates, and the `fulfillment-rules`
helpers. What is missing is the code that combines those pieces with Square
and the database.

## Scope

Vitest tests that mock Supabase, Square, and the auth guards, each next to the
code it covers. Nothing here needs to touch `vitest.config.ts`, `ci.yml`, or
`supabase/tests/`, which the integration plan owns.

## Suggested order

### 1. Square webhook route

[`api/square/webhook/route.ts`](../src/app/api/square/webhook/route.ts) is
public-facing and completes purchases, and has no tests. A good small first
PR. Cover:

- a missing signature (400) and a bad one (403);
- a signature matching any one of several `SQUARE_WEBHOOK_ENDPOINTS`;
- a non-JSON body, or JSON that is not an object (400);
- event types other than `payment.updated` (200, not processed);
- a processing error (500, so Square retries).

Call `POST` with a real `Request`, sign bodies with `WebhooksHelper`, and mock
`processSquarePaymentEvent`.

### 2. Payment fulfillment

[`fulfillment.ts`](../src/features/payments/fulfillment.ts) is mocked out in
every test today. Start with the paths that move money:

- a failed seat reservation cancels the Square payment and marks the purchase
  `canceled`;
- a definitive charge failure releases the seat and marks it `failed`; an
  ambiguous one returns `processing`;
- a retry with the same idempotency key reconciles and never charges twice;
- a pending membership purchase for the same tier is reused.

Then: membership fulfillment sets the expiry and clears
`membership_pre_ordered_type_id`, re-fulfilling is a no-op, a webhook finds a
purchase by `referenceId`, a duplicate webhook changes nothing, and tickets use
`member_price` for members.

Mock `squareClient`, the purchase, registration, and user helpers, the
`reserve_paid_event_ticket` RPC, and `after`, following
[`payments/actions.test.ts`](../src/features/payments/actions.test.ts).

### 3. Server actions

These write through the service role, which bypasses RLS, so their checks are
the only protection.

- [`admin/actions.ts`](../src/features/admin/actions.ts) has no tests. Start
  with `assertManagerUserUpdate`, the allowlist that stops a manager writing
  columns such as `role_access`. Then the role check, the image-discard check,
  and the save, delete, and check-in actions.
- [`memberships/actions.ts`](../src/features/memberships/actions.ts): the lock
  on changing classification during an active or pending membership, and the
  student number, faculty, and year validation.

Mock the guards and `admin-server` helpers, following
[`settings/actions.test.ts`](../src/features/settings/actions.test.ts). Check
that rejected input never reaches the write helper.

### 4. If time allows

- Client hooks: `use-event-form.ts` first, then `use-event-form-draft.ts`,
  `use-application-questions.ts`, and `use-unsaved-changes-guard.ts`.
- Seed scripts: `reconcile-users.ts` and `scripts/seed/index.ts`.

## Coordinating

- Leave the Supabase helpers to the integration plan. A mocked test of a query
  mostly confirms that it calls the mock.
- The integration plan adds a few fulfillment cases against a real database
  once its harness lands. Agree on fixture helpers then.
