-- Blocking UBC email verification for student and faculty memberships. See
-- docs/design/ubc-email-verification.md.
--
-- A UBC student or faculty member proves a UBC address before they can pay
-- for a UBC tier: with a 6-digit code emailed to it, with their confirmed
-- sign-in email when that already qualifies, or by an exec in admin. This
-- migration adds where that proof lives and the three functions the code flow
-- runs through, and records everyone who holds a membership today as
-- grandfathered.
--
-- Backward compatible with the code already in production: the columns are
-- nullable, the table, enum and functions are new, and nothing the old code
-- writes is rejected. `faculty_email` and `student_verified_*` stay, and the
-- new code keeps writing them, until a cleanup migration drops them.

-- ── The verified state, on user_info ───────────────────────────────────────
-- Members read their own row (`select *`), so these are readable to them. No
-- member UPDATE grant: user_info uses column grants, and every write goes
-- through the service role.
create type public.ubc_verification_method as enum (
  'code', 'sign_in_email', 'manual', 'grandfathered'
);

alter table public.user_info
  add column ubc_email text,
  add column ubc_verified_at timestamptz,
  add column ubc_verified_via public.ubc_verification_method,
  add column ubc_verified_by uuid references public.user_info(id) on delete set null;

alter table public.user_info
  add constraint user_info_ubc_email_normalized
    check (ubc_email = lower(btrim(ubc_email))),
  add constraint user_info_ubc_verified_pair
    check ((ubc_verified_at is null) = (ubc_verified_via is null)),
  -- A code or the sign-in email proves an address, so there must be one.
  -- Manual and grandfathered stamps can exist without.
  add constraint user_info_ubc_verified_address
    check (ubc_verified_via not in ('code', 'sign_in_email') or ubc_email is not null),
  add constraint user_info_ubc_verified_by_manual
    check (ubc_verified_by is null or ubc_verified_via = 'manual');

comment on column public.user_info.ubc_email is
  'The profile''s UBC address, verified or not. Lowercase, trimmed.';
comment on column public.user_info.ubc_verified_at is
  'When the UBC verification was stamped. code, sign_in_email and manual count for 365 days; grandfathered lasts while the membership held at migration time does.';

-- The address rules in src/features/memberships/lib/ubc-verification.ts
-- (`validateUbcEmail`): students on student.ubc.ca exactly; faculty on ubc.ca
-- or any *.ubc.ca subdomain except student.ubc.ca, alumni.ubc.ca and theirs.
create function public.ubc_email_qualifies(p_email text, p_user_type public.user_type)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_email is null or p_email !~ '^[^\s@]+@([a-z0-9-]+\.)*ubc\.ca$' then false
    when p_user_type = 'ubcStudent' then split_part(p_email, '@', 2) = 'student.ubc.ca'
    when p_user_type = 'faculty' then not (
      split_part(p_email, '@', 2) in ('student.ubc.ca', 'alumni.ubc.ca')
      or split_part(p_email, '@', 2) like '%.student.ubc.ca'
      or split_part(p_email, '@', 2) like '%.alumni.ubc.ca'
    )
    else false
  end;
$$;
revoke all on function public.ubc_email_qualifies(text, public.user_type) from public, anon, authenticated;

-- ── The pending code ───────────────────────────────────────────────────────
-- Its own table rather than columns: members `select *` their own user_info
-- row, and a hash of a 6-digit code there could be brute-forced offline in
-- milliseconds. Only the service role reads this.
create table public.ubc_verification_codes (
  -- One live code per member. The row stays after a successful verification
  -- (with the code fields nulled) so the send counters survive.
  user_id uuid primary key references public.user_info(id) on delete cascade,
  -- The address the code was sent to.
  email text not null check (email = lower(btrim(email))),
  -- sha256(salt || user_id || ':' || email || ':' || code); null once used.
  code_hash bytea,
  code_salt bytea,
  expires_at timestamptz,
  -- Guesses against the current code; reset on each send.
  attempts smallint not null default 0,
  last_sent_at timestamptz not null,
  window_started_at timestamptz not null,
  sends_in_window smallint not null default 0
);

comment on table public.ubc_verification_codes is
  'The pending UBC verification code per member, hashed. Service role only.';

alter table public.ubc_verification_codes enable row level security;
revoke all on table public.ubc_verification_codes from anon, authenticated;
grant select, insert, update, delete on table public.ubc_verification_codes to service_role;

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Runs before the triggers below exist, on live rows only. Not this
-- migration's business: `updated_at`.
alter table public.user_info disable trigger update_user_info_updated_at;

-- 1. Faculty address: the faculty email on file, when it passes the faculty
--    rule. The earliest row keeps an address two rows share.
with candidates as (
  select id, lower(btrim(faculty_email)) as address,
    row_number() over (
      partition by lower(btrim(faculty_email))
      order by created_at nulls last, id
    ) as rank
  from public.user_info
  where deleted_at is null and user_type = 'faculty' and faculty_email is not null
)
update public.user_info u
set ubc_email = c.address
from candidates c
where c.id = u.id
  and c.rank = 1
  and public.ubc_email_qualifies(c.address, 'faculty');

-- 2. Sign-in email: a confirmed auth address that qualifies for the member's
--    type proves itself. Auth emails are unique, so no two rows get the same
--    verified address here.
update public.user_info u
set ubc_email = lower(btrim(a.email)),
    ubc_verified_at = now(),
    ubc_verified_via = 'sign_in_email'
from auth.users a
where a.id = u.auth_user_id
  and a.email_confirmed_at is not null
  and u.deleted_at is null
  and u.user_type in ('ubcStudent', 'faculty')
  and public.ubc_email_qualifies(lower(btrim(a.email)), u.user_type);

-- 3. Manual: an exec's existing student verification.
update public.user_info
set ubc_verified_at = student_verified_at,
    ubc_verified_via = 'manual',
    ubc_verified_by = student_verified_by
where deleted_at is null
  and ubc_verified_at is null
  and student_verified_at is not null
  and user_type in ('ubcStudent', 'faculty');

-- 4. Grandfathered: everyone else holding an active or pending UBC
--    membership. Their next purchase asks for a code (see
--    `hasPurchaseUbcVerification`), so this only keeps admin from showing
--    them as unverified while the membership they hold lasts.
create function public.grandfather_ubc_members()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.user_info u
  set ubc_verified_at = now(),
      ubc_verified_via = 'grandfathered',
      ubc_verified_by = null
  where u.deleted_at is null
    and u.ubc_verified_at is null
    and u.user_type in ('ubcStudent', 'faculty')
    and (
      u.membership_pre_ordered_type_id is not null
      -- Mirrors `hasActiveMembership`: the earlier of the member's own expiry
      -- and the club-wide term end, unset meaning no end.
      or (
        u.membership_type_id is not null
        and coalesce(
          least(
            u.membership_expires_at,
            (select s.membership_term_ends_at from public.app_settings s limit 1)
          ),
          'infinity'::timestamptz
        ) > now()
      )
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.grandfather_ubc_members() from public, anon, authenticated;
grant execute on function public.grandfather_ubc_members() to service_role;

select public.grandfather_ubc_members();

alter table public.user_info enable trigger update_user_info_updated_at;

-- 5. One account per proven address, so a friend can't reuse someone else's
--    inbox. Only a code or the sign-in email proves an address, so only those
--    hold one: a manual or grandfathered stamp vouches for the member, not
--    for whatever address they type next, and must not block its real owner.
--    Step 2 is the only one that writes proven addresses, and auth emails
--    are unique, so the backfill can't collide here. An unproven address may
--    repeat.
create unique index user_info_ubc_email_verified_key
  on public.user_info (ubc_email)
  where ubc_verified_via in ('code', 'sign_in_email')
    and ubc_email is not null
    and deleted_at is null;

-- ── Keeping the stamp honest ───────────────────────────────────────────────
-- Clears the verification when what it vouched for changes, unless the same
-- update writes a new stamp (a save that re-proves the address with the
-- sign-in email). Also runs during delete_account's anonymization update.
create function public.scrub_ubc_verification() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is not null then
    new.ubc_email := null;
    new.ubc_verified_at := null;
    new.ubc_verified_via := null;
    new.ubc_verified_by := null;
    return new;
  end if;

  if new.ubc_verified_at is distinct from old.ubc_verified_at then
    return new;
  end if;

  if new.user_type is distinct from old.user_type
     or (new.ubc_email is distinct from old.ubc_email
         and old.ubc_verified_via in ('code', 'sign_in_email'))
     or (new.student_number is distinct from old.student_number
         and old.ubc_verified_via = 'manual')
  then
    new.ubc_verified_at := null;
    new.ubc_verified_via := null;
    new.ubc_verified_by := null;
  end if;
  return new;
end;
$$;
revoke all on function public.scrub_ubc_verification() from public, anon, authenticated;
create trigger scrub_ubc_verification before update on public.user_info
for each row execute function public.scrub_ubc_verification();

-- Deletion anonymizes the row rather than deleting it, so the cascade never
-- fires; drop the pending code here instead.
create function public.delete_ubc_code_on_account_deletion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ubc_verification_codes where user_id = new.id;
  return null;
end;
$$;
revoke all on function public.delete_ubc_code_on_account_deletion() from public, anon, authenticated;
create trigger delete_ubc_code_on_account_deletion after update of deleted_at on public.user_info
for each row when (new.deleted_at is not null and old.deleted_at is null)
execute function public.delete_ubc_code_on_account_deletion();

-- ── The code flow ──────────────────────────────────────────────────────────
-- Each function starts by locking the member's user_info row, which
-- serializes everything per member, including the first send, when no code
-- row exists to lock yet. The code itself never reaches the database: Node
-- hashes it, and compares in constant time (src/features/memberships/lib/ubc-code.ts).

-- Records a send to the member's saved address, or refuses it. The caller
-- emails the code only on `ok`.
create function public.claim_ubc_code_send(
  p_user uuid,
  p_email text,
  p_code_hash bytea,
  p_salt bytea
)
returns table (result text, resend_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.user_info%rowtype;
  v_code public.ubc_verification_codes%rowtype;
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_sends smallint;
begin
  select * into v_user from public.user_info
  where id = p_user and deleted_at is null
  for update;

  if not found or v_user.ubc_email is distinct from p_email then
    return query select 'mismatch'::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_user.ubc_verified_via in ('code', 'sign_in_email', 'manual')
     and v_user.ubc_verified_at > v_now - interval '365 days' then
    return query select 'already_verified'::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if exists (
    select 1 from public.user_info o
    where o.id <> p_user
      and o.deleted_at is null
      and o.ubc_email = p_email
      and o.ubc_verified_via in ('code', 'sign_in_email')
      and o.ubc_verified_at > v_now - interval '365 days'
  ) then
    return query select 'taken'::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  select * into v_code from public.ubc_verification_codes c
  where c.user_id = p_user
  for update;

  if found then
    -- Cap first: once it is reached, the countdown would only lead to it.
    if v_code.window_started_at > v_now - interval '24 hours' then
      v_window_started_at := v_code.window_started_at;
      v_sends := v_code.sends_in_window;
    else
      v_window_started_at := v_now;
      v_sends := 0;
    end if;

    if v_sends >= 5 then
      return query select 'daily_cap'::text,
        v_window_started_at + interval '24 hours', null::timestamptz;
      return;
    end if;

    if v_code.last_sent_at > v_now - interval '60 seconds' then
      return query select 'cooldown'::text,
        v_code.last_sent_at + interval '60 seconds',
        -- Only a live code for this same address counts as sent; after an
        -- address change the last code went to the old one.
        case when v_code.code_hash is not null and v_code.email = p_email
          then v_code.expires_at end;
      return;
    end if;

    update public.ubc_verification_codes c
    set email = p_email,
        code_hash = p_code_hash,
        code_salt = p_salt,
        expires_at = v_now + interval '10 minutes',
        attempts = 0,
        last_sent_at = v_now,
        window_started_at = v_window_started_at,
        sends_in_window = v_sends + 1
    where c.user_id = p_user;
  else
    insert into public.ubc_verification_codes (
      user_id, email, code_hash, code_salt, expires_at, attempts,
      last_sent_at, window_started_at, sends_in_window
    ) values (
      p_user, p_email, p_code_hash, p_salt, v_now + interval '10 minutes', 0,
      v_now, v_now, 1
    );
  end if;

  return query select 'ok'::text,
    v_now + interval '60 seconds', v_now + interval '10 minutes';
end;
$$;

-- Counts one guess and hands Node the hash to compare against. The count is
-- taken under the lock, so parallel guesses can't exceed five.
create function public.begin_ubc_code_attempt(p_user uuid, p_email text)
returns table (
  result text,
  challenge_sent_at timestamptz,
  code_hash bytea,
  code_salt bytea,
  attempts_left smallint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.user_info%rowtype;
  v_code public.ubc_verification_codes%rowtype;
begin
  select * into v_user from public.user_info
  where id = p_user and deleted_at is null
  for update;

  if not found then
    return query select 'none'::text, null::timestamptz, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  select * into v_code from public.ubc_verification_codes c
  where c.user_id = p_user
  for update;

  if not found or v_code.code_hash is null then
    return query select 'none'::text, null::timestamptz, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  if v_code.email <> p_email or v_user.ubc_email is distinct from p_email then
    return query select 'stale'::text, null::timestamptz, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  if v_code.expires_at <= now() then
    return query select 'expired'::text, null::timestamptz, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  if v_code.attempts >= 5 then
    return query select 'locked'::text, null::timestamptz, null::bytea, null::bytea, 0::smallint;
    return;
  end if;

  update public.ubc_verification_codes c
  set attempts = c.attempts + 1
  where c.user_id = p_user;

  return query select 'ok'::text, v_code.last_sent_at, v_code.code_hash,
    v_code.code_salt, (5 - v_code.attempts - 1)::smallint;
end;
$$;

-- Stamps the verification after Node found the code correct, for the same
-- send it compared against.
create function public.complete_ubc_code_verification(
  p_user uuid,
  p_email text,
  p_challenge_sent_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.user_info%rowtype;
  v_code public.ubc_verification_codes%rowtype;
begin
  select * into v_user from public.user_info
  where id = p_user and deleted_at is null
  for update;

  if not found or v_user.ubc_email is distinct from p_email then
    return 'stale';
  end if;

  if v_user.ubc_verified_via = 'code'
     and v_user.ubc_verified_at > now() - interval '365 days' then
    return 'already_verified';
  end if;

  select * into v_code from public.ubc_verification_codes c
  where c.user_id = p_user
  for update;

  if not found
     or v_code.code_hash is null
     or v_code.email <> p_email
     or v_code.last_sent_at <> p_challenge_sent_at then
    return 'stale';
  end if;

  -- A proven hold over a year old no longer counts (see `claim_ubc_code_send`).
  update public.user_info o
  set ubc_verified_at = null, ubc_verified_via = null, ubc_verified_by = null
  where o.id <> p_user
    and o.deleted_at is null
    and o.ubc_email = p_email
    and o.ubc_verified_via in ('code', 'sign_in_email')
    and o.ubc_verified_at <= now() - interval '365 days';

  begin
    update public.user_info
    set ubc_verified_at = now(),
        ubc_verified_via = 'code',
        ubc_verified_by = null
    where id = p_user;
  exception when unique_violation then
    return 'taken';
  end;

  update public.ubc_verification_codes c
  set code_hash = null, code_salt = null, expires_at = null, attempts = 0
  where c.user_id = p_user;

  return 'verified';
end;
$$;

revoke all on function public.claim_ubc_code_send(uuid, text, bytea, bytea) from public, anon, authenticated;
revoke all on function public.begin_ubc_code_attempt(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_ubc_code_verification(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_ubc_code_send(uuid, text, bytea, bytea) to service_role;
grant execute on function public.begin_ubc_code_attempt(uuid, text) to service_role;
grant execute on function public.complete_ubc_code_verification(uuid, text, timestamptz) to service_role;
