# Codebase Cleanup

**Status:** Completed
**Created:** 2026-07-26
**Scope:** Everything surfaced by the codebase review that was not an authorization
issue — dead code, duplicated logic, oversized components, unrendered public
pages, and the absent test harness.

Authorization work is tracked separately in
[security-hardening/](./security-hardening/) and is out of scope here.

---

## Motivation

The security hardening pass moved every admin page to a server component, added
`eligible_user_types`, made event deletion atomic, and deleted the
`link-auth-user` route. That was a large change, and it left the codebase in a
mixed state:

- Helpers orphaned by the refactor are still exported and still compile.
- The patterns it introduced — server components, colocated server actions —
  now apply to only half the app. The public marketing pages and three portal
  pages still fetch from the browser.
- Nothing in the repo tests any of it. `supabase/tests/rls.sql` covers policy
  behavior; there is no runner for application code, so the payment and
  eligibility logic — the code most expensive to get wrong — has no coverage at
  all.

None of this is urgent in the way the RLS findings were. It is the kind of debt
that compounds quietly: every new contributor learns the codebase from whichever
half they happen to open first.

---

## Findings

| # | Issue | Evidence | Phase |
|---|---|---|---|
| C1 | 5 unreferenced components/hooks, 10 unreferenced exports | `MessageCard`, `useEventDetail`, `deleteEvent`, … | [1](#phase-1--delete-what-nothing-references) |
| C2 | 3 dependencies with zero imports | `date-fns`, both `@fortawesome/*` | [1](#phase-1--delete-what-nothing-references) |
| C3 | Two Radix packages installed side by side | `radix-ui` + 4× `@radix-ui/react-*` | [1](#phase-1--delete-what-nothing-references) |
| C4 | No test runner for application code | `package.json` has no test script | [2](#phase-2--establish-a-test-harness) |
| C5 | 11 hand-rolled date formatters, inconsistent behavior | `formatDate` ×6, `formatTime` ×4, `formatTimestamp` | [3](#phase-3--consolidate-duplicated-logic) |
| C6 | Type re-export layer that only forwards | `features/*/types/*.ts` | [3](#phase-3--consolidate-duplicated-logic) |
| C7 | `UserProvider` mounted twice; server `initialUser` discarded | `app/layout.tsx:59`, `(app)/layout.tsx:15` | [3](#phase-3--consolidate-duplicated-logic) |
| C8 | Eligibility rules implemented twice | `membership/page.tsx:58`, `fulfillment.ts:80` | [3](#phase-3--consolidate-duplicated-logic) |
| C9 | Public marketing pages render a spinner to crawlers | `/`, `/events`, `/events/[slug]` | [4](#phase-4--server-render-the-public-pages) |
| C10 | Duplicate marketing `Button`/`EventCard` with dead props | `features/marketing/components/` | [4](#phase-4--server-render-the-public-pages) |
| C11 | `EventCreateModify` is 1298 lines / 6 effects / 9 state hooks | `EventCreateModify.tsx` | [5](#phase-5--decompose-the-last-large-client-components) |
| C12 | 3 portal pages still client-fetched | `portal/page`, `portal/events`, `membership/page` | [5](#phase-5--decompose-the-last-large-client-components) |
| C13 | Stale `/portal/profile` references; `/auth/callback` undocumented | `fulfillment.ts:205`, `structure-and-routes.md:195,233` | [3](#phase-3--consolidate-duplicated-logic) |

---

## Phases

Five phases, ordered so each one makes the next safer.

| Phase | Goal | Risk |
|---|---|---|
| [1](#phase-1--delete-what-nothing-references) | Delete dead code and dependencies | None — nothing references it |
| [2](#phase-2--establish-a-test-harness) | Test runner + coverage on payments and eligibility | None — additive |
| [3](#phase-3--consolidate-duplicated-logic) | Collapse duplicated logic to one implementation | Low, and now covered by Phase 2 |
| [4](#phase-4--server-render-the-public-pages) | Server-render `/`, `/events`, `/events/[slug]` | Medium — visible, public |
| [5](#phase-5--decompose-the-last-large-client-components) | Break up `EventCreateModify`; finish the portal | Medium — largest diff |

**Why tests come second.** Phase 3 rewrites eligibility and date handling, both
of which feed the checkout path. Doing that with no runner means verifying by
clicking through Square's sandbox. Phase 2 is cheap and turns Phases 3–5 from
"looks right" into "still passes."

---

### Phase 1 — Delete what nothing references

Mechanical, and independently shippable. Every item below was confirmed
unreferenced outside its own file and the barrel that re-exports it.

**Components and hooks** — delete the file and its barrel entry:

```
src/components/shared/MessageCard.tsx
src/features/admin/components/AdminPageSkeleton.tsx
src/features/events/components/EventStatusCard.tsx
src/features/events/components/EventDetailsCard.tsx
src/features/events/hooks/useEventDetail.ts
```

**Exports** — remove from their modules:

| Export | File | Note |
|---|---|---|
| `PURCHASE_KINDS`, `PURCHASE_STATUSES` | `features/payments/types.ts` | The derived types stay |
| `SQUARE_API_VERSION` | `lib/square/client.ts` | Inline it at the `SquareClient` call |
| `fetchPurchaseForUser` | `lib/supabase-helpers/purchases.ts` | |
| `fetchPurchaseHistoryForUser` | `lib/supabase-helpers/event-registrations.ts` | |
| `fetchEventIdsWithApplications` | `lib/supabase-helpers/event-applications.ts` | |
| `deleteEvent` | `lib/supabase-helpers/events.ts` | Orphaned by `delete_event_atomically` |
| `deleteRegistrationsForEvent` | `lib/supabase-helpers/event-registrations.ts` | ″ |
| `deleteFailedPurchasesForEvent` | `lib/supabase-helpers/purchases.ts` | ″ |
| `ensureEventPurchasesAreDeletable` | `lib/supabase-helpers/purchases.ts` | ″ |

The last four are worth a moment: the security pass replaced a four-call
browser-orchestrated cascade with the `delete_event_atomically` RPC, which fixed
a real non-atomicity bug. These helpers are what it replaced.

**Dependencies:**

```bash
pnpm remove date-fns @fortawesome/free-solid-svg-icons @fortawesome/react-fontawesome
```

`date-fns` has zero imports — `react-day-picker` carries its own copy as a
transitive dependency, so `pnpm build` is the check that this is safe. Both
FontAwesome packages have zero imports; `lucide-react` and `react-icons` are the
libraries actually in use.

**C3 — pick one Radix package.** `radix-ui` (the unified package) is used by
`popover`, `sheet`, `tooltip`, and `sidebar`; `@radix-ui/react-dialog`, `-label`,
`-select`, and `-separator` are used individually elsewhere. Standardize on the
unified `radix-ui` and drop the four scoped packages — it is the direction
shadcn has moved, and it removes a class of version-skew bug where two copies of
`@radix-ui/react-primitive` end up in the tree.

**Do not delete** — these look unreferenced to a grep but are framework
contracts:

- `src/proxy.ts` (`proxy`, `config`) — Next 16's renamed `middleware.ts`, wired
  by filename.
- `viewport` in `src/app/layout.tsx` — a Next metadata export.

**Verify:** `pnpm lint && pnpm exec tsc --noEmit && pnpm build`.

---

### Phase 2 — Establish a test harness

Add Vitest. It shares Vite's transform pipeline, needs no Babel config alongside
the React Compiler, and runs TypeScript directly.

```bash
pnpm add -D vitest @vitest/coverage-v8
```

```jsonc
// package.json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Target the pure logic first — the code with the highest cost of failure and the
lowest cost to test, because it needs neither a DOM nor a database:

| Module | What to cover |
|---|---|
| `features/payments/schemas.ts` | `parseCheckoutRequest` — every rejection branch; a malformed payload reaching Square is the failure that costs money |
| `features/payments/fulfillment.ts` | `normalizeSquareStatus`, `splitBuyerName`, `getSquareErrorMessage`, `formatReservationFailure`, `isMembershipPurchasableForUser` |
| `features/memberships/lib/validation.ts` | `validateStudentNumber`, `validateFacultyEmail` — the UBC subdomain regex has edge cases worth pinning |
| `features/events/helpers/eventApplication.ts` | `prepareResponseData` |
| `lib/slug.ts` | `slugify`, `createUniqueSlug` collision handling |

Several of these are currently module-private in `fulfillment.ts`. Export them,
or extract them to a sibling `fulfillment-rules.ts` — the latter is cleaner,
since it separates the pure decision logic from the I/O-heavy orchestration and
makes the file's 648 lines easier to navigate.

Wire `pnpm test` into CI alongside `lint` and `tsc`. Do not chase a coverage
number; the goal is a harness that exists and a habit of adding to it.

**Deliberately out of scope for this phase:** component tests, E2E, and anything
requiring a live Supabase. Those are worth doing later, but a runner plus real
coverage of the payment path is the step that changes the risk profile.

---

### Phase 3 — Consolidate duplicated logic

**C5 — one date module.** `formatDate`, `formatTime`, and `formatTimestamp` are
redefined 11 times across pages, cards, and settings panels, with behavior that
drifts between copies: some wrap in `try/catch` and some don't, some use `en-US`
and some `en-CA`, some parse bare `"HH:mm"` strings and some assume ISO. Create
`src/lib/date.ts` with `formatEventDate`, `formatEventTime`, and
`formatTimestamp`, and replace all 11.

Timezone handling deserves a decision rather than an accident. `EventCreateModify`
deliberately pins `America/Los_Angeles` when defaulting a new event's start; every
display site renders in whatever the browser's zone is. For a UBC club that is
almost always the same thing — until someone opens the portal from another
timezone and sees a different start time than the admin entered. Pin the display
formatters to Pacific too, and note it in the module docstring.

**C8 — one eligibility rule.** `canPurchase` (`membership/page.tsx:58`) and
`isMembershipPurchasableForUser` (`fulfillment.ts:80`) now both read
`eligible_user_types`, so the fragile substring matching is gone — but they are
still two implementations of the same predicate that must agree. Extract one
shared function. The server keeps enforcement; the client keeps the call
site as a display hint, which is what it already is post-hardening.

**C6 — collapse the type re-export layer.** Two of these files forward a single
type and add nothing:

```ts
// features/auth/types/userTypes.ts — the entire file
export type { UserInfoRow } from "@/types/models";
```

`memberships/types/membershipTypes.ts` is identical in form, and
`events/types/applicationTypes.ts` re-exports `ApplicationStatus` and then
re-imports it two lines down. The cost is real: `UserInfoRow` is imported from
three different paths today, so a reader cannot tell whether two modules share a
type without following each chain.

Delete the pure pass-throughs and import from `@/types/models`. **Keep** the type
files that declare genuinely feature-local shapes — `GroupedRegistration`,
`CheckInSessionDraft`, `ApplicationQuestionTemplate`, `MarketingEventCard`, the
`userManagementTypes` set.

**C7 — mount `UserProvider` once.** It wraps the tree in `app/layout.tsx:59` and
again in `(app)/layout.tsx:15`. Two consequences:

1. The root instance runs `getSession()` plus a `user_info` fetch on every
   marketing and auth page, where no consumer reads it.
2. The provider unconditionally re-fetches on mount (`UserContext.tsx:79`), so
   the `initialUser` the server already resolved via `requireAuth()` is thrown
   away and re-queried from the browser.

Remove the root-layout instance. Then make the provider skip its initial fetch
when `initialUser` is supplied, keeping the auth-state subscription for sign-out
and cross-tab changes.

While in the file: the five `setTimeout(…, 0)` wrappers are working around a
React state-update warning rather than fixing its cause, and the `silent`
parameter on `loadUser` is dead — the only call passing `true` is guarded by
`event === "TOKEN_REFRESHED"`, which the branch above it already returned on
(`UserContext.tsx:88`). The file should come out around 40 lines.

Any component reading `useUser()` under `(app)` is affected. Check for flashes of
signed-out state on `/portal` and `/admin` after this change.

**C13 — fix the stale route references.** `/portal/profile` was deleted in
`0bde61d` but survives in `fulfillment.ts:205` (a `revalidatePath` for a route
that no longer exists) and in `docs/structure-and-routes.md:195,233`. The line
below it, `revalidatePath("/portal/membership/${slug}")`, targets the legacy
ID-based redirect route, so a slug never matches it — either drop it or point it
at the real path.

The route tree in `structure-and-routes.md` is otherwise current — the security
pass updated it — with one gap: `auth/callback/route.ts` is missing beside
`confirm/route.ts` at line 37, despite being the OAuth entry point.

---

### Phase 4 — Server-render the public pages

All three public pages are `"use client"` and fetch from the browser. These are
the SEO surface, and they currently serve a spinner to crawlers and to first
paint. The data is public and identical for every visitor.

**`/events`** — the simplest. `fetchEvents` on the server, drop the `useEffect`
and the loading state.

**`/` (homepage)** — the page itself is presentational; only `EventsSection`
fetches, and it does so with a raw `.from("events")` call
(`EventsSection.tsx:17`) that bypasses the helper boundary. Lift the fetch into
the page as a server component, pass events down as props, and keep `DotGrid`
(GSAP, pointer-driven) as the only client island.

**`/events/[slug]`** — 591 lines, and the most valuable conversion. It runs three
sequential round-trips *after* JS loads: a slug lookup, an ID-fallback lookup,
then a registration count. Replace the first two with `fetchEventBySlug` — the
fallback exists because the route once accepted bare IDs, and the legacy
membership route already establishes the redirect pattern for that. Extract the
small signed-in-only "already registered" badge into a client child so the rest
of the page can render statically.

Add `export const revalidate = 300` to all three. Events change rarely; a
five-minute window makes these effectively static without a publish step.

**C10 — the duplicate marketing components.** `features/marketing/components/`
holds a second `Button` with its own variant vocabulary (`primary` / `secondary`
/ `noBorder`) and a second `EventCard`, both unrelated to their `components/ui`
and `features/events` counterparts. The marketing `EventCard` accepts
`buttonText` and `buttonIcon` and renders neither — `EventsSection.tsx:26`
builds ~40 lines of inline triangle and star SVG and alternates labels
(`"office tour"` / `"competition"`) by array index, and the component drops all
of it on the floor. Delete the unused props, the SVGs, and the alternation.

The `MarketingEventCard` type in `features/marketing/types/index.ts` describes
those same phantom fields; trim it to what the component reads.

**Not in this phase:** the `.marketing-home` token boundary
(`globals.css:137`), which redefines `--color-black: #383838` and
`--color-white: #f0eff2` inside the marketing subtree. That inversion — marketing
changing what "black" means — is why its components hardcode hexes like
`border-[#C1C7CD]`. Untangling it means renaming tokens across every marketing
component with no automated way to catch a regression. Worth doing; worth doing
deliberately, with a designer looking at it. See [Follow-on work](#follow-on-work).

**Verify:** `curl` each route and confirm event content is present in the HTML
source, not just in the JS bundle. That is the whole point of the phase, and it
is easy to half-finish without noticing.

---

### Phase 5 — Decompose the last large client components

**C11 — `EventCreateModify` (1298 lines).** Already down from 1516 after the
security pass moved its writes into `adminEventAction`. What remains in one
component: 9 `useState` hooks, 6 `useEffect`s, a `beforeunload` handler, a
document-level click interceptor, `localStorage` draft persistence, Pacific-time
defaulting, slug generation, image upload, and application-question editing. The
`event-form/*` children are purely presentational — all state lives in the
parent.

Extract, in order of independence:

| Extract | Contents |
|---|---|
| `useUnsavedChangesGuard` | `beforeunload`, the document click interceptor, `bypassUnsavedChangesWarning` |
| `useEventFormDraft` | `localStorage` persistence under `STORAGE_KEY`, snapshot comparison |
| `lib/event-form-schema.ts` | `isDateTimeRangeInvalid`, `isEventScheduleRangeInvalid`, question validation — pure, so testable under Phase 2 |
| `useEventForm` | Remaining form state, field changes, submit orchestration |

The component that remains should mostly compose `event-form/*` children.

Fold the datetime helpers (`timestamptzToDatetimeLocal`,
`datetimeLocalToTimestamptz`, the Pacific defaults) into the Phase 3 date module
rather than leaving them here.

**C12 — the last three client-fetched portal pages.** With admin already
converted, these are what's left:

- `portal/page.tsx` — reads only `useUser()`; becomes a server component using
  `requireAuth()`'s return value directly.
- `portal/events/page.tsx` — fetches all events, then the user's registrations,
  then filters client-side. Move both fetches to the server and filter there.
- `portal/membership/page.tsx` — fetch tiers on the server; keep the purchase
  button as a client island.

`features/admin/actions.ts` is the established pattern for the mutation side.

**C14 — `ProfileSettings` (435 lines)** grew during the hardening work and now
mixes a display card, an edit form, a hand-rolled toggle switch, and the
eligibility fields that route through `updateEligibilityProfileAction`. Split the
display and edit halves, and replace the bespoke toggle with a `ui/` primitive.
Lower priority than the two above.

---

## Exit criteria

- [x] `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm test` pass.
- [x] No unreferenced components, exports, or dependencies remain (re-run the
      reachability sweep from Phase 1).
- [x] Exactly one date-formatting module, one eligibility predicate, and one
      `UserProvider` mount.
- [x] `curl https://…/events/<slug>` returns event content in the HTML.
- [x] No hand-written file in `src/` exceeds ~500 lines. Excludes generated
      `database.types.ts` and vendored shadcn primitives such as
      `components/ui/sidebar.tsx`.
- [x] `docs/structure-and-routes.md` matches the actual route tree: the
      `/portal/profile` references at lines 195 and 233 are gone, and
      `/auth/callback/route.ts` is listed alongside `confirm/route.ts`.

---

## Follow-on work

Out of scope here; recorded so the boundary is explicit.

- **The `.marketing-home` token boundary** (see Phase 4). Needs a designer in the
  loop, and ideally visual-regression coverage before anyone touches it.
- **Event images to Supabase Storage.** `/api/upload-event-image` writes into
  `public/` on the running container, so uploads do not survive a deploy. This
  is a correctness bug, not a cleanup item, and is already tracked in
  [security-hardening/](./security-hardening/#out-of-scope) — it likely deserves
  promoting to its own plan.
- **Component and E2E tests** on top of the Phase 2 harness.
- **`AGENTS.md` / `CLAUDE.md` duplication.** `AGENTS.md` is a partial copy of
  `CLAUDE.md` that has already drifted (it still describes the app as having a
  marketing homepage and portal, with no mention of route groups). Reducing it to
  a pointer would stop the drift, but it is a repo-convention decision rather
  than a code change.
