-- Migration: drop 'archived' from event_status enum; update events SELECT
-- policy to respect publish_at.
--
-- Requirements:
--   1.2  Existing archived events → draft before enum value is removed.
--   1.1  event_status contains exactly 'draft' and 'active'.
--   1.4  Non-admin SELECT policy: status = 'active' AND
--          (publish_at IS NULL OR publish_at <= now()).
--        Admin policy (is_admin()) unchanged: sees every event.
--
-- Postgres cannot remove a value from an existing enum, so the standard
-- rename-old / create-new / alter-column / drop-old dance is used.
-- The column ALTER takes a brief ACCESS EXCLUSIVE lock on events, which is
-- acceptable at current table size.


-- ── 1. Convert archived rows to draft ────────────────────────────────────
--
-- Must run before the column type is changed; the USING expression below
-- will fail if any row still holds 'archived'.

update public.events
set status = 'draft'
where status = 'archived';


-- ── 2. Recreate event_status without 'archived' ───────────────────────────

alter type public.event_status rename to event_status_old;

create type public.event_status as enum ('draft', 'active');

alter table public.events
  alter column status type public.event_status
    using status::text::public.event_status;

-- The DEFAULT still references the type by name; re-applying it makes sure
-- it binds to the new type rather than the old one.
alter table public.events
  alter column status set default 'draft'::public.event_status;

drop type public.event_status_old;


-- ── 3. Update the events SELECT policies ──────────────────────────────────
--
-- Drop the public policy created in 20260702234500_add_event_status.sql and
-- recreate it with the publish_at guard.
-- The admin policy (last set in 20260907132000_allow_managers_to_view_draft_events.sql)
-- is unchanged in its logic (is_admin() sees all), but we drop and recreate
-- it so its comment stays accurate.

drop policy if exists "everyone can view active events" on public.events;
drop policy if exists "admin_select_all_events"          on public.events;

-- Non-admin users (authenticated and anon) see only events that are active
-- AND whose scheduled publish time has arrived (or has no schedule).
create policy "everyone can view active events"
  on public.events
  for select
  to authenticated, anon
  using (
    status = 'active'::public.event_status
    and (publish_at is null or publish_at <= now())
  );

-- Admins and managers see every event regardless of status or publish_at.
create policy "admin_select_all_events"
  on public.events
  for select
  to authenticated
  using (public.is_admin());

comment on policy "admin_select_all_events" on public.events is
  'Admins and managers may view draft and scheduled events; everyone else only '
  'sees active, published events through the public select policy.';
