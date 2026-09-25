# Dependency upgrade plan

A suggested plan for bringing production dependencies up to date, reviewed
2026-09-24. Adjust the order and scope as you go, and delete an item once it
has shipped.

## Background

`pnpm audit --prod` reports 78 advisories: 2 critical, 34 high, 37 moderate,
and 5 low. Nearly all of them come from three packages:

| Package         | Current → latest  | Critical / high advisories                          |
| --------------- | ----------------- | --------------------------------------------------- |
| `next`          | 16.0.10 → 16.3.6  | 2 critical, 13 high, plus `sharp`, `postcss`, `nanoid` |
| `square`        | 43.2.1 → 46.0.0   | 11 high, through `axios` and `form-data`            |
| `@supabase/ssr` | 0.7.0 → 0.12.7    | 1 high, through `ws`                                |

The portal is live and takes payments, so do this before any other feature
work lands on top.

## Suggested order

One PR per step. Each runs `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`,
and `pnpm build`, and ends with a fresh `pnpm audit --prod`.

### 1. Next and React

`next` 16.0.10 → 16.3.x and `react` / `react-dom` 19.2.0 → 19.3.x. Both are
pinned exactly in `package.json`. Move `eslint-config-next` (16.0.1) to the
same version as `next`, and check that `babel-plugin-react-compiler` still
matches.

This is low risk and clears most of the critical and high advisories, so land
it first. Check by hand on a preview deploy: the membership dialog, which uses
the `@flow` intercepting routes, and the prerendered `/events/[slug]`.

### 2. Square

`square` 43 → 46 is three major versions in the payment path. Read the SDK
changelog for each major, then fix what `tsc` flags in
[`src/lib/square`](../src/lib/square) and
[`src/features/payments`](../src/features/payments). Bump `@square/web-sdk`
(2.1 → 2.3) in the same PR.

Land it after the webhook and fulfillment tests from
[`ci-test-gaps-unit.md`](ci-test-gaps-unit.md), or give it to whoever writes
them. Check by hand in the Square sandbox: a membership purchase, a ticket
purchase, a card that needs `verifyBuyer`, and webhook delivery.

### 3. Supabase

`@supabase/ssr` 0.7 → 0.12 and `@supabase/supabase-js` 2.101 → 2.117. The
`ssr` package handles auth cookies, and a 0.x minor bump can break the API.
Review [`src/proxy.ts`](../src/proxy.ts) and
[`src/lib/supabase`](../src/lib/supabase) against its changelog, and run
`pnpm test:rls`.

Check by hand: sign-in, sign-out, password recovery, and a session that
outlives its access token and refreshes through the proxy.

### 4. The rest

Minor bumps: `radix-ui`, `@radix-ui/react-slot`, `resend`, `gsap`,
`react-icons`, `tailwind-merge`. `lucide-react` 0.x → 1.x is a major version;
fix renamed icons where `tsc` flags them.

### 5. Keep it from drifting

Add Dependabot or Renovate config under `.github/`. Group minor and patch
updates weekly, and open security updates on their own.

## Coordinating

- Step 2 touches the same files as the fulfillment work in the unit test plan.
  Agree on who goes first.
- Sentry integration, if it happens this week, also edits `next.config`. Land
  step 1 before it.
