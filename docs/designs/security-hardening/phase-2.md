# Phase 2 — Server-Side Privileged Access

**Goal:** Make `requireAdmin()` mean something.
**Prerequisite:** [Phase 1](./phase-1.md) shipped.
**Unblocks:** [Phase 3](./phase-3.md).

Today `requireAdmin()` guards the page shell while the data behind it arrives
over an anon-key query from the browser. The guard is therefore cosmetic: the
real control is RLS, and Phase 1 only fixed RLS for `user_info`.

This phase moves privileged reads and writes to the server, which is what lets
Phase 3 close the remaining policies without breaking admin workflows.

---

## `/admin/users`

The most entangled page, and the reason Phase 1c's column grants are awkward.

- Convert to a server component. Fetch via `fetchAdminUserRecords` with the
  **server** client, behind `requireAdmin()`.
- Replace the inline field editor's direct `updateUserInfoByEmail` call with a
  server action that re-checks `requireAdmin()` and uses the **service-role**
  client for the privileged columns (`role_access`, `membership_type_id`).
- Once this lands, remove any temporary column grants added in
  [Phase 1c](./phase-1.md#column-grants).

Worth cleaning up while in here, though not security-critical:

- `users` and `filteredUsers` are both held in state with a `useEffect` syncing
  them; the filter/sort is pure derivation and belongs in a `useMemo`.
- `handleEditSave`'s field-coercion ladder (`:139–163`) reimplements per-column
  typing that the generated `UserInfoUpdate` type already describes.
- The `as unknown as UserRecord[]` double cast (`:63`) is hiding a fixable join
  type.
- Errors surface via `alert()`.

## `/admin/events/*`

Same treatment: server-render the reads behind `requireAdmin()`, and move
mutations into server actions.

One thing to fix rather than port as-is: the event delete path in
`EventCreateModify` orchestrates four calls from the browser —
`deleteRegistrationsForEvent` → `ensureEventPurchasesAreDeletable` →
`deleteFailedPurchasesForEvent` → `deleteEvent`. It is non-atomic, so a
mid-sequence failure leaves a half-deleted event. Fold it into one server action
wrapping a single transaction, or a Postgres function.

The check-in page's realtime subscription needs to stay client-side. Keep the
initial fetch server-rendered and let the subscription patch from there.

## `/portal/*`

Less urgent — Phase 1 and 3 policies scope these to the caller anyway, so the
anon-key fetch is no longer a security problem. Convert opportunistically for the
latency win.

`/portal/events` is the exception worth doing deliberately: it fetches **all**
events and filters client-side against the user's registrations.

## Cleanup

- Delete `ensureUserInfo` (`users.ts:104`). It inserts a non-existent
  `membership_type` column and would fail at runtime; it is unreachable behind
  `requireAuth()`. Its only caller (`useEventApplication.ts:80`) can use
  `user.id` directly, which also removes a redundant `getSession()` call.
- Drop any browser-facing admin policies that existed only to support the
  client-side admin pages converted above.

---

## Exit criteria

- [x] No admin page fetches privileged data with the anon key.
- [x] All admin mutations run through server actions that call `requireAdmin()`.
- [x] Temporary column grants from Phase 1c removed.
- [x] Event deletion is atomic.
- [ ] Admin workflows verified end to end on staging: user editing, event
      create/edit/delete, application review, check-in.
