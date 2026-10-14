# Sentry integration plan

A plan for adding error reporting with Sentry, written 2026-10-13. Work through
it in order on a branch off `main`, and delete this doc once it has shipped.

## Background

Errors today go to two places, and nobody watches either:

- **Server:** [`log.error`](../src/lib/log.ts) writes one JSON line to the
  Vercel runtime logs. Nothing alerts, and the logs are kept for a short time.
- **Client:** [`(shell)/error.tsx`](../src/app/(app)/(shell)/error.tsx) calls
  `console.error`, which only prints in the student's own browser.

The main goal is being alerted to payment failures, where a student may have
paid and not received a ticket or membership. Crash reports with readable stack
traces come second.

## Decisions

| Question | Decision |
| --- | --- |
| Exception messages | Scrub on the server, keep on the client. Server code rethrows raw Supabase errors (`if (error) throw error;`, 77 sites), and their messages can quote row data. Client messages describe the bug and rarely contain data. |
| `diagnostic` log field | Keep only Square codes, categories, and CVV/AVS statuses. Drop free text. |
| Preview deploys | Report them with `environment: preview`. Alert on production only. |
| Performance tracing | Off (`tracesSampleRate: 0`) at first, to keep the free quota for errors. |
| Session Replay | Off. |
| `Sentry.setUser` | Later PR. Id only, never an email. |

## 0. Setup outside the repo

1. Create a Sentry project on the Next.js platform. Note the DSN, the org slug,
   and the project slug.
2. Create an org auth token with permission to upload source maps.
3. In Vercel, add:
   - `NEXT_PUBLIC_SENTRY_DSN` to Production and Preview, not Development.
   - `SENTRY_ORG` and `SENTRY_PROJECT` to all environments.
   - `SENTRY_AUTH_TOKEN` to Production and Preview. It is a secret.

   The Sentry integration in the Vercel marketplace can set these for you.
4. Install the latest `@sentry/nextjs`. Next 16 builds with Turbopack, so check
   that its release notes list Turbopack source map upload for Next 16.

```bash
pnpm add @sentry/nextjs
```

## 1. SDK setup

| File | Change |
| --- | --- |
| `src/lib/sentry.ts` | New. Shared `init` options and `scrubServerEvent` / `scrubClientEvent` |
| `src/instrumentation.ts` | New. `register()` imports the server config when `NEXT_RUNTIME === "nodejs"`; `export const onRequestError = Sentry.captureRequestError` |
| `src/sentry.server.config.ts` | New. `Sentry.init` with the shared options and `beforeSend: scrubServerEvent` |
| `src/instrumentation-client.ts` | New. `Sentry.init` with `beforeSend: scrubClientEvent`; `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart` |
| `src/app/global-error.tsx` | New. Client component; calls `Sentry.captureException(error)` in `useEffect` and renders its own `<html><body>` with a "Something went wrong" message styled like `(shell)/error.tsx` |
| `next.config.ts` | Wrap in `withSentryConfig(nextConfig, { org, project, authToken, tunnelRoute: "/monitoring", silent: !process.env.CI })` |

There is no edge config: nothing in `src` sets the edge runtime, and Next 16 runs
[`proxy.ts`](../src/proxy.ts) on Node. Add one if that changes.

**Shared options** (`src/lib/sentry.ts`):

```ts
{
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, // unset locally and in CI → disabled
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  sendDefaultPii: false,
  tracesSampleRate: 0,
}
```

`enabled` follows the DSN, so no extra flag logic is needed. Use
`NEXT_PUBLIC_VERCEL_ENV` on both sides, as [`flags.ts`](../src/lib/flags.ts)
does.

**`scrubServerEvent(event, hint)`:**

- Replace each `event.exception.values[].value` with the error type, plus the
  `code` read from `hint.originalException` when there is one. For example,
  `PostgrestError 23505` (unique violation) or `PostgrestError 42501` (RLS).
- Delete `event.request.data`, `cookies`, `query_string`, and every header
  except `user-agent`.
- Drop breadcrumbs in the `console` category. `log.error` already sends what
  matters, and other libraries' console output is unreviewed.
- Strip the query string and hash from every URL (see below).

**`scrubClientEvent(event)`:**

- Keep exception messages.
- Strip the query string and hash from `event.request.url` and from
  `navigation`, `fetch`, and `xhr` breadcrumbs. The auth callback receives a
  one-time `?code=` ([`callback/route.ts`](../src/app/(auth)/auth/callback/route.ts)),
  and that should not reach a third party.

Route paths are safe to keep: portal routes use slugs and admin routes use ids.

The `/monitoring` tunnel route is not in the `proxy.ts` matcher, so it does not
trigger session refreshes. CI has no auth token, so the plugin skips the source
map upload; `silent` hides the warning.

## 2. Error boundaries

- [`(shell)/error.tsx`](../src/app/(app)/(shell)/error.tsx): replace
  `console.error(error)` with `Sentry.captureException(error)`. A server error
  reaches this boundary as a `digest` only, and `onRequestError` has already
  reported it, scrubbed. This call catches client-side crashes.
- The marketing and auth route groups have no `error.tsx`, so
  `global-error.tsx` covers them.

## 3. Connect `log.error` to Sentry

In `emit` in [`log.ts`](../src/lib/log.ts):

```ts
if (level === "error") {
  Sentry.captureMessage(event, {
    level: "error",
    fingerprint: [event],
    tags: { event },
    extra: fields,
  });
}
```

- `fingerprint: [event]` groups every occurrence of an event name into one
  issue.
- The `event` tag lets alert rules match `payment.*` and similar patterns.
- Only `error` is forwarded. `warn` and `info` stay in the logs.
- The fields are the same ones the logs already accept, so the `log.ts`
  guarantees carry over.

**Tests** in [`log.test.ts`](../src/lib/log.test.ts): `vi.mock("@sentry/nextjs")`,
then assert that `error` calls `captureMessage` with the fingerprint and tag,
and that `warn` and `info` do not.

## 4. Keep card declines out of Sentry

`payment.ticket_charge_failed` and `payment.membership_charge_failed` are logged
before the code checks what kind of failure it was, so ordinary card declines
are logged as errors.

In [`fulfillment.ts`](../src/features/payments/fulfillment.ts) (both catch
blocks), choose the level with the existing `isDefinitiveSquareFailure(error)`:

```ts
if (isDefinitiveSquareFailure(error)) {
  log.warn("payment.ticket_charge_declined", { purchaseId, diagnostic });
} else {
  log.error("payment.ticket_charge_failed", { purchaseId, diagnostic });
}
```

Ambiguous codes and non-Square errors stay at `error`, which is right: those
are the cases where the money state is unclear.

**Tests** in [`fulfillment.test.ts`](../src/features/payments/fulfillment.test.ts):
a decline logs `warn`, and an ambiguous or network failure logs `error`.

## 5. Tighten `getSquareErrorDiagnostic`

In [`fulfillment-rules.ts`](../src/features/payments/fulfillment-rules.ts):

- Square errors: keep `code (category)` and the CVV/AVS statuses, and drop
  `detail`.
- Any other error: return the error type (and `code` if present) instead of
  `error.message`, matching `errorFields`.

This also tightens the Vercel logs. Update the expected string in
[`fulfillment-rules.test.ts`](../src/features/payments/fulfillment-rules.test.ts)
(currently it includes `Authorization error: 'GENERIC_DECLINE'`), and add a
case for a non-Square error.

The Square webhook ([`webhook.ts`](../src/lib/square/webhook.ts)) throws a
message containing payload details, but the route logs it through
`errorFields`, and server scrubbing covers it anyway. No change is needed there.

## 6. Docs

- `CLAUDE.md`, Environment: the four variables, and which are secret.
- `CLAUDE.md`, Important Patterns: `log.error` reports to Sentry and alerts, so
  use `warn` for expected failures such as declines and validation errors.
- `.env.local.example`: an empty `NEXT_PUBLIC_SENTRY_DSN=` with a comment that
  leaving it empty disables Sentry locally.

## 7. Sentry project settings

- **Advanced Data Scrubbing:** add rules that replace email addresses and
  8-digit numbers (student numbers) in all fields. This is a backstop for
  client messages.
- **Alerts:**
  - Immediate (email or Discord) for `environment:production` issues whose
    `event` tag matches `payment.*`, `webhook.*`, `checkout.*`, or `account.*`.
  - Immediate for any new unhandled error in production.
  - Weekly digest for everything else.
- **Inbound filters:** turn on the browser-extension and legacy-browser filters.

## Verification

Automated:

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build
```

Also run `pnpm build` with `NEXT_PUBLIC_SENTRY_DSN` unset, as CI does.

By hand, on a preview deploy (`environment: preview`):

- [ ] A client-side throw appears as an issue with a readable stack trace,
      which confirms source maps uploaded.
- [ ] A throwing server action appears through `onRequestError`, with the
      message replaced by the error type.
- [ ] One `log.error` event appears as one issue, tagged with its event name.
- [ ] A Square Sandbox decline (test Visa `4111 1111 1111 1111` with CVV `911`)
      produces no issue.
- [ ] In the raw JSON of an event: no email, no cookies, no request body, and
      no query string on the auth callback URL.

Remove any temporary throw used for these checks before merging.

## Later

- `Sentry.setUser({ id })` from the authenticated layout, so issues show how
  many students are affected.
- Light performance tracing (`tracesSampleRate: 0.05`) on checkout, if the
  quota allows.
