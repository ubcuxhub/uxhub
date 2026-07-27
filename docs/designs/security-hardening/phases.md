# Phasing and Rollout

See [README.md](./README.md) for motivation, findings, and the target model.

## The four phases

| Phase | Goal | Ships independently? |
|---|---|---|
| [0 — Verify](./phase-0.md) | Confirm each finding against a real instance | n/a — no changes |
| [1 — Stop the bleeding](./phase-1.md) | Close F1, F2, F3, F6 | Yes |
| [2 — Server-side privileged access](./phase-2.md) | Make `requireAdmin()` mean something | Yes |
| [3 — Scope remaining tables](./phase-3.md) | Close F4, F5, F7, F9 | Yes, after 2 |

## Why this order

Phase 1 is first because it holds all three criticals and its changes are close
to independent of the rest of the app.

Phase 2 sits between 1 and 3 for a specific reason: **tightening RLS breaks any
page that was silently relying on a permissive policy.** Admin pages are all
client-fetched with the anon key, so they are exactly the pages that break. They
have to move server-side before the remaining policies close.

Phase 3 is last because it is the widest surface and the least urgent — its
findings require an authenticated account, unlike F1 and F2.

### Why F3 needs an expanded trigger, not just column grants

RLS cannot express column scoping. The existing
`prevent_role_access_change_trigger` correctly blocks self-promotion, but it
only covers `role_access`; F3 needs that trigger expanded to all privileged
columns. The obvious alternative — column-level `UPDATE` grants — is not
sufficient on its own, and the reason is worth stating clearly because it is
easy to get backwards.

Grants apply to the `authenticated` **role**, which includes admins. Admins
legitimately edit `role_access` and `membership_type_id` from `/admin/users`. So
a grant strict enough to stop self-elevation also stops admin editing, and a
grant loose enough for admins leaves self-elevation open.

**It is tempting to argue that the RLS policy covers the loose case — it does
not.** The policy restricts a user to rows where `auth_user_id = auth.uid()`,
i.e. their own row. But F3 *is* a user writing their own row. Restricting them to
it does not protect membership or eligibility fields.

A `BEFORE UPDATE` trigger resolves this, because it evaluates per statement and
can ask *who is acting*:

```sql
create or replace function public.guard_user_info_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service-role client connects as a role that bypasses RLS; let
  -- fulfillment and server actions through untouched.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role_access is distinct from old.role_access
     or new.membership_type_id is distinct from old.membership_type_id
     or new.membership_pre_ordered_type_id is distinct from old.membership_pre_ordered_type_id
     or new.membership_expires_at is distinct from old.membership_expires_at
     or new.square_customer_id is distinct from old.square_customer_id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.email is distinct from old.email
  then
    raise exception 'Cannot modify privileged columns on user_info';
  end if;

  return new;
end;
$$;

create trigger user_info_guard_privileged_columns
  before update on public.user_info
  for each row execute function public.guard_user_info_privileged_columns();
```

Verify the `auth.uid() is null` escape hatch behaves as intended for the
service-role client during Phase 0 — if it does not, gate on
`current_setting('role')` instead. Getting this wrong either blocks fulfillment
or opens the door.

Column grants remain worthwhile as defence in depth for columns *nobody* should
write from the browser (`auth_user_id`, `email`, `square_customer_id`), but the
trigger is the load-bearing control.

**Consequence for ordering:** with the trigger in place, 1c and Phase 2 are no
longer entangled — admins keep browser editing until Phase 2 moves it
server-side. 1c can ship first.

## Verification

Add a `supabase/tests/rls.sql` suite — pgTAP, or plain SQL assertions run through
`psql`. Each case seeds two users, one plain and one admin, and asserts **both**
the allow and the deny direction:

| Case | Expect |
|---|---|
| anon selects `user_info` | 0 rows |
| user A selects own `user_info` | 1 row |
| user A selects user B's `user_info` | 0 rows |
| admin selects `user_info` | all rows |
| user A sets own `role_access = 'admin'` | rejected |
| user A sets own `membership_type_id` | rejected |
| user A updates own `name` | accepted |
| admin sets user B's `role_access` | accepted |
| service role sets any `membership_type_id` | accepted |
| user A selects user B's registration | 0 rows |
| user A updates user B's registration `status` | rejected |
| user A **inserts** own registration with `status='accepted'` | rejected |
| user A inserts own registration with `status='pending'` | accepted |
| admin updates any registration `status` | accepted |
| user A reads user B's application responses | 0 rows |

The deny-direction assertions are the point. An allow-only suite passes just as
happily against `USING (true)` — which is how this class of bug survives review
in the first place.

Run against a local instance in CI:

```bash
supabase db reset && pnpm seed && psql -f supabase/tests/rls.sql
```

The seed script authenticates with the service-role key and bypasses RLS, so it
is unaffected by these changes and remains usable for fixture setup.

## Rollout

**The main risk is availability, not security.** Every migration here can take a
working page and make it return zero rows.

1. Phase 1a, 1b, 1c on a branch. Verify locally with `supabase db reset`.
2. Apply to staging. Walk **every** route in the `CLAUDE.md` route list, as both
   a plain user and an admin. The blast radius is wide enough that spot-checking
   will miss something.
3. Ship Phase 1 to production. F1–F3 are worth moving on quickly.
4. Phase 2 and 3 follow at normal review pace.

Write and test a `down` migration for each change. Reverting a bad RLS change
under pressure, without a prepared script, is how you end up back at
`USING (true)`.

## Operational follow-ups

Independent of the phases, both tied to F2:

- **Rotate the service-role key** after Phase 1a. The deleted route exercised it
  on behalf of unauthenticated callers.
- **Audit for prior exploitation** before shipping. Check `user_info` for rows
  whose `auth_user_id` changed unexpectedly, and for `role_access = 'admin'` on
  accounts that should not have it.
