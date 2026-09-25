# Integration test plan

A suggested plan for the integration-test gaps in CI, reviewed 2026-09-23.
Adjust the order and scope as you go, and delete an item once it is covered. A
separate plan covers the unit gaps in [`ci-test-gaps-unit.md`](ci-test-gaps-unit.md).

## Background

CI's `build` job starts a throwaway Supabase with every migration applied and
runs [`supabase/tests/rls.sql`](../supabase/tests/rls.sql). That script is the
only test that touches a real database, and it checks access control only. No
Vitest test runs the app's code against a database, and the only database
function anything calls is `set_user_role`.

## Scope

SQL suites in the style of `rls.sql`, and Vitest tests that call the app's
TypeScript against the local Supabase. This plan owns `vitest.config.ts`,
`ci.yml`, and `supabase/tests/`.

## Suggested order

### 1. Harness

A first PR that adds:

- a separate Vitest project, run with something like `pnpm test:integration`,
  pointed at the local Supabase;
- a CI step in the `build` job after `Verify RLS policies`, since that job
  already starts the database;
- isolation like `rls.sql`'s: roll back each test's transaction, or scope it
  to its own fixtures, so it is safe on a seeded database.

### 2. Database functions

- `reserve_paid_event_ticket`: each failure reason (`EVENT_NOT_FOUND`,
  `EVENT_NOT_ACTIVE`, `APPLICATION_REQUIRED`, `REGISTRATION_NOT_OPEN`,
  `REGISTRATION_CLOSED`, `ALREADY_REGISTERED`, `SOLD_OUT`), the capacity count,
  and a repeat call for the same purchase.
- `release_paid_event_ticket_reservation` frees only the seat it reserved.
- `save_admin_event_atomically` and `delete_event_atomically` are
  all-or-nothing, and respect the cover-image guard.
- `delete_account` and `event_registration_counts`.

Their execute grants are already asserted in `rls.sql`.

### 3. RLS assertions

Add to `rls.sql`:

- **`purchases`:** a member reads only their own, cannot insert or update one,
  and an admin may delete only failed event-ticket purchases.
- **`check_ins`:** a non-admin cannot insert, update, or delete one.
- **Admin-only tables:** a basic user cannot write to `events`,
  `membership_types`, mentors, sponsors, or application questions.
- **`square_webhook_events`:** `anon` and `authenticated` have no access.
- **`event-images` bucket:** `anon` and `authenticated` cannot upload or
  delete. It has no `storage.objects` policies on purpose (see
  [Storage](../supabase/README.md#storage)), so this guards against one being
  added.

### 4. Supabase helpers

Only `memberships.ts` in `src/lib/supabase-helpers` has tests, and those use a
fake client. Start with the confirmation-email claim and release in
`purchases.ts`, which keep a receipt to one send, and the duplicate check in
`recordSquareWebhookEvent`. Then `check-ins.ts`, and
`adminDeleteEventImageByUrl` ignoring URLs outside the bucket.

### 5. Fulfillment against the database

With only Square mocked, add a few cases to
[`fulfillment.ts`](../src/features/payments/fulfillment.ts), such as buying the
last seat and replaying a webhook. The unit plan covers its logic with mocks,
so agree on fixture helpers first.

## Later

End-to-end tests need their own tooling decision. Nothing drives the app
today, so routing and a full checkout are checked only by `next build`
compiling. Leave this until both plans are done.
