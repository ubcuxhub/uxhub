# Unit test plan

A suggested plan for closing the unit-test gaps in
[`ci-test-gaps.md`](ci-test-gaps.md). Adjust the order and scope as you go. The
integration half is in [`ci-test-gaps-integration.md`](ci-test-gaps-integration.md).

## Scope

Vitest tests that mock Supabase, Square, and the auth guards. Each new file sits
next to the code it covers. This plan does not need to touch `vitest.config.ts`,
`ci.yml`, or `supabase/tests/`, which keeps it clear of the integration work.

## Suggested order

1. **Webhook route (gap 2).** A small first PR. Call `POST` with a real
   `Request`, sign bodies with `WebhooksHelper`, and mock
   `processSquarePaymentEvent`.
2. **Fulfillment (gap 1).** The largest item. Mock `squareClient`, the purchase,
   registration, and user helpers, and `after`, following
   [`payments/actions.test.ts`](../src/features/payments/actions.test.ts). Start
   with the paths that move money: a failed reservation cancels the charge, a
   definitive failure marks the purchase `failed`, and a retry never charges
   twice.
3. **Server actions (gap 4).** Start with `assertManagerUserUpdate` in
   [`admin/actions.ts`](../src/features/admin/actions.ts), then
   [`memberships/actions.ts`](../src/features/memberships/actions.ts). Follow
   [`settings/actions.test.ts`](../src/features/settings/actions.test.ts).
4. **If time allows:** client hooks (gap 7, `use-event-form` first), then the
   seed scripts (gap 9).

## Worth knowing

- Supabase helpers (gap 6) are left to the integration plan. A mocked test of a
  query mostly confirms that it calls the mock.
- Mocked fulfillment tests check the order of calls, not what they do to the
  database. The integration plan adds a few fulfillment cases against a real
  database once its harness lands, so agree on fixture helpers then.
