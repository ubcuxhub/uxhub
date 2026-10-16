# Unit test plan

A suggested plan for the unit-test gaps in CI, reviewed 2026-09-23. Adjust the
order and scope as you go, and delete an item once it is covered. A separate
plan covers the integration gaps in
[`ci-test-gaps-integration.md`](ci-test-gaps-integration.md).

## Background

`pnpm test` runs about 50 Vitest files. Pure logic is well covered: schemas,
membership policy, auth guards, email templates, and the `fulfillment-rules`
helpers. The Square webhook route, payment fulfillment, and
[`admin/actions.ts`](../src/features/admin/actions.ts) are covered too. What is
left is the rest of the code that combines those pieces with Square and the
database.

## Scope

Vitest tests that mock Supabase, Square, and the auth guards, each next to the
code it covers. Nothing here needs to touch `vitest.config.ts`, `ci.yml`, or
`supabase/tests/`, which the integration plan owns.

## Suggested order

### 1. Server actions

These write through the service role, which bypasses RLS, so their checks are
the only protection.

- [`memberships/actions.ts`](../src/features/memberships/actions.ts): the lock
  on changing classification during an active or pending membership, and the
  student number, faculty, and year validation.

Mock the guards and `admin-server` helpers, following
[`settings/actions.test.ts`](../src/features/settings/actions.test.ts). Check
that rejected input never reaches the write helper.

### 2. If time allows

- Client hooks: `use-event-form.ts` first, then `use-event-form-draft.ts`,
  `use-application-questions.ts`, and `use-unsaved-changes-guard.ts`.
- Seed scripts: `reconcile-users.ts` and `scripts/seed/index.ts`.

## Coordinating

- Leave the Supabase helpers to the integration plan. A mocked test of a query
  mostly confirms that it calls the mock.
- The integration plan adds a few fulfillment cases against a real database
  once its harness lands. Agree on fixture helpers then.
