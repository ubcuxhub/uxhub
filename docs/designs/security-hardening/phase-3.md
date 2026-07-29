# Phase 3 — Scope Remaining Tables

**Goal:** Close F4, F5, F7, F9.
**Prerequisite:** [Phase 2](./phase-2.md) shipped — admin reads and writes must
already be server-side, or these policies will break application review and
check-in.

---

## Registrations and application responses (F4, F5)

New migration: `harden_registration_rls`. Uses the helpers introduced in
[Phase 1c](./phase-1.md#shared-helpers).

```sql
drop policy if exists "user can select event registrations" on public.event_registrations;
drop policy if exists "user can insert event registrations" on public.event_registrations;
drop policy if exists "user can update event registrations" on public.event_registrations;
drop policy if exists "user can delete event registrations" on public.event_registrations;

create policy "registrations: read own"
  on public.event_registrations for select to authenticated
  using (user_id = public.current_user_info_id());

create policy "registrations: admins read all"
  on public.event_registrations for select to authenticated
  using (public.is_admin());

-- Scoping the row to the caller is NOT enough on its own: without pinning
-- the privileged columns, a user can insert their own row pre-approved.
create policy "registrations: insert own"
  on public.event_registrations for insert to authenticated
  with check (
    user_id = public.current_user_info_id()
    and status = 'pending'::public.application_status
    and attending is not true
    and purchase_id is null
  );

create policy "registrations: admins write"
  on public.event_registrations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

The `with check` constraints on insert matter as much as the `user_id` one. A
policy that only verified ownership would let an applicant `INSERT` their own
registration with `status = 'accepted'` and `attending = true` — self-approval
through the front door, with no update policy needed. Paid registrations are
created by the fulfillment path with the service-role client, which bypasses this
policy, so pinning `purchase_id` here costs nothing.

Note the absence of a user-facing `UPDATE` or `DELETE` policy. Status transitions
are an authorization decision — they belong to admins and to the fulfillment path
(service role), not to applicants. An applicant who needs to withdraw should go
through a server action that sets a withdrawal status, not a direct `DELETE`.

Apply the same pattern to `event_application_responses`, scoping ownership
through the parent registration:

```sql
using (
  event_registration_id in (
    select id from public.event_registrations
    where user_id = public.current_user_info_id()
  )
)
```

Applicants should keep `INSERT` and `UPDATE` on their own responses — that is the
application form — but lose `SELECT` and `DELETE` on everyone else's.

---

## Purchases grant (F9)

```sql
revoke all on table public.purchases from anon;
```

RLS already holds the line here, so this is defence in depth rather than an open
hole. Cheap to do while in the area.

---

## Low-severity leftovers (F10)

Two `USING (true)` policies that survived the earlier passes because the data is
near-public anyway:

- `check_in_sessions` — session names and times, visible to any authenticated
  user. Scope to admins plus users registered for the event.
- `event_application_questions` — the questions themselves, shown to every
  applicant by design. Leaving this open is defensible; scoping it to events with
  open registration is tidier.

Neither is urgent. Do them here because the policy file is already open, not
because they represent real exposure.

---

## Membership eligibility (F7)

`user_type` and `student_number` are the inputs to `canPurchase`
(`membership/page.tsx:58`) and `isMembershipPurchasableForUser`
(`fulfillment.ts:81`). Both are written from the browser by `MembershipWizard`
and `ProfileSettings` — so eligibility is currently self-attested. Set
`user_type: 'nonUbc'` and the cheapest tier unlocks.

**Fix:**

1. Move those two fields behind a server action.
2. Keep them excluded from the Phase 1c column grant.
3. Treat `fulfillment.ts` as the authority. The client-side `canPurchase` becomes
   a display hint only — which is what it should always have been.

Changing `user_type` after a membership is active is now an admin action. The
server action rejects eligibility changes while either an active or pre-ordered
membership exists. Faculty eligibility additionally requires the submitted UBC
address to match the signed-in account email.

### The deeper smell

Both functions match tier **names** by substring — `"explorer"`, `"innovator"`,
`"faculty"`, `"non"` — and the rules are duplicated byte-for-byte across the
client and the server. `CLAUDE.md` already flags these names as load-bearing,
which is a sign the schema is missing a field.

Adding `eligible_user_types user_type[]` to `membership_types` removes both the
duplication and the string coupling. Worth doing here, since the eligibility path
is already open.

---

## Exit criteria

- [x] A user cannot read another user's registration or application responses.
- [x] A user cannot change any registration's `status`.
- [x] Admins can still review applications and run check-in.
- [x] Applicants can still submit and edit their own applications.
- [x] Eligibility cannot be changed directly from the browser.
- [x] The full `supabase/tests/rls.sql` matrix in
      [phases.md](./phases.md#verification) passes, deny cases included.
