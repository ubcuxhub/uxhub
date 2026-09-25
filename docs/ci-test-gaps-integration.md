# Integration test plan

A suggested plan for closing the integration-test gaps in
[`ci-test-gaps.md`](ci-test-gaps.md). Adjust the order and scope as you go. The
unit half is in [`ci-test-gaps-unit.md`](ci-test-gaps-unit.md).

## Scope

Tests that run against a real Postgres with every migration applied: SQL
suites in the style of [`rls.sql`](../supabase/tests/rls.sql), and Vitest tests
that call the app's TypeScript against the local Supabase. This plan owns
`vitest.config.ts`, `ci.yml`, and `supabase/tests/`.

## Suggested order

1. **Harness.** A first PR that adds:
   - a separate Vitest project, run with something like
     `pnpm test:integration`, pointed at the local Supabase;
   - a CI step in the `build` job, after `Verify RLS policies`, since that job
     already starts the database;
   - isolation in the style of `rls.sql`: roll back each test's transaction, or
     scope it to its own fixtures, so it is safe on a seeded database.
2. **Database functions (gap 3).** Start with `reserve_paid_event_ticket`: each
   failure reason, the capacity count, and a repeat call for the same purchase.
   Then the release, atomic save, atomic delete, and `delete_account`
   functions. The execute grants are already covered.
3. **RLS assertions (gap 5).** `purchases` first, then `check_ins`, the
   admin-only tables, `square_webhook_events`, and the `event-images` bucket.
4. **Supabase helpers (gap 6).** Start with the confirmation-email claim and
   release in `purchases.ts`, and the duplicate check in
   `recordSquareWebhookEvent`.
5. **Fulfillment against the database.** Once the harness lands, add a few
   cases with only Square mocked, such as buying the last seat and replaying a
   webhook. Agree on fixture helpers with the unit plan first.

## Later

End-to-end tests (gap 8) need their own tooling decision. Leave them until both
plans are done.
