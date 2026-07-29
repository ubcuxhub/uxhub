# Phase 1 — Stop the Bleeding

**Goal:** Close F1 and F2, harden the remaining privileged columns in F3, and
authenticate the upload in F6.
**Prerequisite:** [Phase 0](./phase-0.md) verification complete.

These changes are close to independent of the rest of the app and should ship
together.

---

## 1a — Delete `/api/link-auth-user` (F2)

The route is an unauthenticated account-takeover endpoint — see
[README.md#f2](./README.md#f2--apilink-auth-user-is-an-account-takeover-endpoint).
A correct implementation of the same flow already exists at
`/api/auth/complete-profile`, so this is a deletion, not a patch.

**Steps**

1. Point `sign-up-form.tsx:76` at `POST /api/auth/complete-profile`.
2. Delete `src/app/api/link-auth-user/route.ts`.
3. Delete the now-unreferenced service-role helpers from `admin-server.ts`:
   `adminUpdateUserInfoByEmail`, `adminFindUserInfoIdByEmail`,
   `adminUpdateMembershipByEmail`.

**Side benefit:** this also removes the `newsletter: "true"` bug, where a string
literal was written into a `boolean` column (`route.ts:64`, `:84`).

> ### Check this before switching
>
> Sign-up currently creates the auth user client-side and *then* calls the API to
> create the profile row. `/api/auth/complete-profile` requires a **session**,
> which exists immediately after `signUp()` only when email confirmation is
> **disabled**.
>
> Confirm which mode the Supabase project uses. If confirmation is enabled,
> sign-up should create only the auth user and let the existing
> `/auth/callback` → `/auth/complete-profile` path create the profile row. That
> path is already built and already handles the email-collision case.

---

## 1b — Authenticate the image upload (F6)

Add `await requireAdmin()` at the top of `/api/upload-event-image`.

Two lines. It should not wait on the Supabase Storage migration noted in
[README.md#out-of-scope](./README.md#out-of-scope) — that fixes a *different*
problem (deploys wiping `public/`), and bundling them delays the auth fix for no
reason.

---

## 1c — Lock down `user_info` (F1, F3, F8)

New migration: `harden_user_info_rls`.

### Shared helpers

Both functions are `SECURITY DEFINER`, meaning their bodies are not themselves
subject to RLS. Phase 0 found no recursion in the installed policy set, so this
is primarily a canonical, caller-based role check and a way to keep policy
behavior independent from caller-visible rows.

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_info
    where auth_user_id = auth.uid()
      and role_access = 'admin'::public.role_access_enum
  );
$$;

-- Resolves the caller's user_info.id, for tables that key on it rather than
-- on auth.uid() directly (event_registrations, purchases, ...).
create or replace function public.current_user_info_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.user_info where auth_user_id = auth.uid();
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_user_info_id() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_info_id() to authenticated;
```

`set search_path = public` is not decoration — a `SECURITY DEFINER` function
without a pinned search path is itself a privilege-escalation vector.

### Policies

```sql
-- F1 + F8: replace blanket visibility with self-or-admin.
drop policy if exists "visibility" on public.user_info;
drop policy if exists "admin_select_all" on public.user_info;

create policy "user_info: read own row"
  on public.user_info for select to authenticated
  using (auth_user_id = auth.uid());

create policy "user_info: admins read all"
  on public.user_info for select to authenticated
  using (public.is_admin());

-- F3: key self-update on auth_user_id, not the user-editable email column.
drop policy if exists "allow current user to update its own row" on public.user_info;

create policy "user_info: update own row"
  on public.user_info for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
```

### Privileged-column guard

RLS has no column concept, so F3 needs a second mechanism.

The migration must remove the existing narrow guard before installing the
expanded one:

```sql
drop trigger if exists prevent_role_access_change_trigger on public.user_info;
drop function if exists public.prevent_role_access_change();
```

**The load-bearing control is a `BEFORE UPDATE` trigger, not a column grant.**
Grants apply to the whole `authenticated` role, which includes admins, so no
grant can both permit admin edits and block self-elevation. See
[phases.md](./phases.md#why-f3-needs-a-trigger-not-just-column-grants) for the
trigger definition and the reasoning — including the plausible-but-wrong argument
that the RLS row restriction covers this.

Column grants are still worth adding as defence in depth, for columns nothing in
the browser should ever write:

```sql
revoke update on public.user_info from authenticated;
grant update (
  name, preferred_pronouns, phone, faculty, major, year,
  dietary_restrictions, newsletter,
  -- Admin-only in practice, enforced by the trigger. Granted here so
  -- /admin/users keeps working until Phase 2 moves it server-side.
  role_access, membership_type_id
) on public.user_info to authenticated;
```

Columns the trigger rejects for non-admins, and why:

| Column | Reason |
|---|---|
| `role_access` | The escalation vector itself |
| `membership_type_id`, `membership_pre_ordered_type_id`, `membership_expires_at` | Paid state — belongs to the fulfillment path |
| `square_customer_id` | Written by fulfillment only |
| `auth_user_id`, `email` | Identity join keys |
| `user_type`, `student_number` | Eligibility inputs — see [Phase 3](./phase-3.md) (F7) |

The service-role client bypasses both the trigger and the grants, so these
columns become server-write-only for ordinary users while fulfillment keeps
working.

> **`MembershipWizard` and `ProfileSettings` break on contact**, because both
> write `user_type` / `student_number` from the browser. That is intended — those
> are the eligibility inputs behind F7. [Phase 3](./phase-3.md#membership-eligibility-f7)
> moves them to a server action. If Phase 3 is far off, leave those two columns
> out of the trigger's reject list and accept F7 remaining open until then;
> do **not** leave `role_access` out.

---

## Exit criteria

- [x] Anon key returns 0 rows from `user_info`.
- [x] A non-admin cannot set their own `role_access` or membership columns.
- [x] A non-admin can still edit their own name, phone, faculty, etc.
- [x] An admin **can** still set another user's `role_access` from `/admin/users`
      (confirms the trigger's admin path works before Phase 2 lands).
- [x] Square fulfillment can still write `membership_type_id` and
      `square_customer_id` (confirms the trigger's service-role escape hatch).
- [x] An admin can still read the full user directory.
- [x] `/api/link-auth-user` returns 404.
- [ ] Sign-up creates a `user_info` row end to end, in whichever email
      confirmation mode the project uses.
- [x] `/api/upload-event-image` rejects non-admins.
- [ ] Service-role key rotated (see [phases.md](./phases.md#operational-follow-ups)).
