-- Migration: application_status enum, event_applications table, backfill from
-- event_registrations, repoint event_application_responses, and RLS.
--
-- Requirements addressed:
--   3.1  application_status enum = submitted, accepted, rejected, waitlisted.
--   3.2  event_applications has UNIQUE(event_id, user_id), default 'submitted'.
--   3.3  CHECK: accepted rows must have offer_expires_at.
--   3.4  Backfill: pending→submitted, declined→rejected, accepted→accepted;
--        accepted rows with no deadline get now() + 30 days.
--   3.5  event_application_responses gains application_id FK (event_registration_id
--        is NOT dropped here — that happens in the final clean-up migration).
--   3.6  RLS: users read/insert own rows; admins read and update all.
--
-- Postgres cannot drop enum values, so the rename-old / create-new / alter-
-- column / drop-old pattern is used (same as task 4 for event_status).
-- The column ALTER takes a brief ACCESS EXCLUSIVE lock on event_registrations,
-- which is acceptable at current table size.
--
-- This migration is safe to run on a populated database.  Both the old
-- event_registrations table and the old event_registration_id column on
-- event_application_responses remain in place so the currently-deployed
-- application code keeps working until task 7 updates it.


set search_path = '';


-- ── 1. Recreate application_status with the new values ───────────────────
--
-- Old values: pending, declined, accepted
-- New values: submitted, accepted, rejected, waitlisted
--
-- Step 1a: update the column to TEXT so the old type can be dropped.
-- Step 1b: rename old type, create new type, alter column, drop old type.

alter table public.event_registrations
  alter column status type text;

alter type public.application_status rename to application_status_old;

create type public.application_status as enum (
  'submitted',
  'accepted',
  'rejected',
  'waitlisted'
);

-- Step 1c: convert the text column to the new enum, mapping old→new values.
update public.event_registrations
set status = case status
  when 'pending'  then 'submitted'
  when 'declined' then 'rejected'
  when 'accepted' then 'accepted'
  else                 'submitted'  -- safety fallback for any unexpected value
end;

alter table public.event_registrations
  alter column status type public.application_status
    using status::public.application_status;

alter table public.event_registrations
  alter column status set default 'submitted'::public.application_status;

-- Also update the INSERT policy that hard-codes the old 'pending' literal so
-- it stays valid.  The policy was last set by
-- 20260727030000_harden_registration_rls.sql.
drop policy if exists "registrations: insert own pending" on public.event_registrations;

create policy "registrations: insert own pending"
  on public.event_registrations
  for insert
  to authenticated
  with check (
    user_id = public.current_user_info_id()
    and status = 'submitted'::public.application_status
    and attending is not true
    and purchase_id is null
  );

drop type public.application_status_old;


-- ── 2. Create event_applications ─────────────────────────────────────────

create table public.event_applications (
  id               uuid        not null default gen_random_uuid(),
  event_id         uuid        not null,
  user_id          uuid        not null,
  status           public.application_status not null default 'submitted',
  offer_expires_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint event_applications_pkey
    primary key (id),
  constraint event_applications_event_id_fkey
    foreign key (event_id) references public.events (id) on delete cascade,
  constraint event_applications_user_id_fkey
    foreign key (user_id) references public.user_info (id),
  constraint event_applications_event_id_user_id_key
    unique (event_id, user_id),
  constraint event_applications_accepted_requires_deadline
    check (status <> 'accepted' or offer_expires_at is not null)
);

create index event_applications_event_id_idx
  on public.event_applications (event_id);

create index event_applications_user_id_idx
  on public.event_applications (user_id);

create trigger update_event_applications_updated_at
  before update on public.event_applications
  for each row execute function public.update_updated_at_column();


-- ── 3. Backfill from event_registrations ─────────────────────────────────
--
-- Every row in event_registrations represents an application; backfill them
-- all. Accepted rows that have no offer_expires_at get now() + 30 days so
-- the CHECK constraint on event_applications holds.

insert into public.event_applications (
  id,
  event_id,
  user_id,
  status,
  offer_expires_at,
  created_at,
  updated_at
)
select
  reg.id,                                         -- preserve the same UUID
  reg.event_id,
  reg.user_id,
  reg.status,                                     -- already converted above
  case
    when reg.status = 'accepted' then now() + interval '30 days'
    else null
  end,
  reg.created_at,
  reg.updated_at
from public.event_registrations reg
on conflict (event_id, user_id) do nothing;      -- idempotent re-runs


-- ── 4. Repoint event_application_responses ───────────────────────────────
--
-- Add the new application_id column and backfill it from the existing
-- event_registration_id FK.  event_registration_id is NOT dropped here —
-- the clean-up migration (task 6 / drop-legacy) removes it after the
-- app code has been updated.

alter table public.event_application_responses
  add column if not exists application_id uuid
    references public.event_applications (id) on delete cascade;

-- Backfill: the backfilled event_applications rows have the same UUID as the
-- corresponding event_registrations rows, so a direct copy works.
update public.event_application_responses
set application_id = event_registration_id
where application_id is null
  and event_registration_id is not null;

-- Add a unique constraint matching the proposed schema (per question per
-- application).  The existing unique constraint on (question_id,
-- event_registration_id) from the original schema is left in place for now.
create unique index if not exists
  event_application_responses_question_id_application_id_key
  on public.event_application_responses (event_application_question_id, application_id)
  where application_id is not null;


-- ── 5. RLS for event_applications ────────────────────────────────────────

alter table public.event_applications enable row level security;

-- Users may read their own applications.
create policy "applications: read own"
  on public.event_applications
  for select
  to authenticated
  using (user_id = public.current_user_info_id());

-- Admins (and managers, via is_admin()) may read every application.
create policy "applications: admins read all"
  on public.event_applications
  for select
  to authenticated
  using (public.is_admin());

-- Users may insert only their own application with the default submitted status.
create policy "applications: insert own"
  on public.event_applications
  for insert
  to authenticated
  with check (
    user_id = public.current_user_info_id()
    and status = 'submitted'::public.application_status
  );

-- Admins may update any application (e.g. to accept, reject, waitlist).
create policy "applications: admins update"
  on public.event_applications
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ── 6. Grants ─────────────────────────────────────────────────────────────

grant all on table public.event_applications
  to anon, authenticated, service_role;
