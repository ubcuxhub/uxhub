-- Step 3 of docs/registration-rollout.md: drops the legacy registration schema.
-- The code deployed since step 2 reads and writes only event_tickets,
-- event_applications and the new event columns, so nothing live uses what
-- goes here.
--
--   - runs the backfill one last time, for registrations the step 1 code wrote
--     before step 2 deployed;
--   - archived events become active if they have ended, else draft, and
--     event_status loses 'archived';
--   - the policies that read event_registrations or the legacy columns move to
--     event_tickets, event_applications and the new columns, before anything
--     they read is dropped;
--   - check-ins and application responses keep only their ticket and
--     application links, which become required;
--   - drops event_registrations, its functions, the legacy events columns, the
--     sync trigger and its helpers, the backfill, and application_status.
--
-- Rows deleted on the hosted project:
--   - every event_registrations row. The backfill has copied each one that was
--     a ticket (attending) or an application (on an applications_enabled
--     event); the rest were reservations whose payment never completed, or
--     registrations on events that take no applications;
--   - check-ins still without a ticket after relinking, and application
--     responses still without an application. See below.

select public.backfill_event_tickets_and_applications();

-- ── event_status without 'archived' ──────────────────────────────────────
--
-- An archived event that has ended becomes active, so it stays in members'
-- history as a past event (docs/event-states.md). One that has not ended, or
-- has no dates, becomes a draft, hidden as it was. Archived events never hold
-- a publish_at (events_publish_schedule_requires_draft).

update public.events
set status = case
  when coalesce(ends_at, starts_at) < now() then 'active'
  else 'draft'
end::public.event_status
where status = 'archived';

-- Everything that names the type or reads events.status in a policy, check,
-- index or trigger column list blocks the column's type change, so it comes
-- off here and back, unchanged, after.
drop policy "everyone can view active events" on public.events;
drop policy "public can view mentors for active events" on public.mentors;
drop policy "public can view sponsors for active events" on public.sponsors;
drop policy "public can view mentor links for active events" on public.event_mentors;
drop policy "public can view sponsor links for active events" on public.event_sponsors;
drop policy "applications: insert own" on public.event_applications;
drop function public.event_is_public(public.event_status, timestamptz);

alter table public.events drop constraint events_publish_schedule_requires_draft;
drop index public.events_pending_publication_idx;
drop trigger lock_event_publication_schedule on public.events;
drop trigger reschedule_event_publication_after_write on public.events;
drop trigger sync_event_publication_watchdog on public.events;
alter table public.events alter column status drop default;

alter type public.event_status rename to event_status_with_archived;
create type public.event_status as enum ('draft', 'active');
alter table public.events
  alter column status type public.event_status using status::text::public.event_status;
alter table public.events alter column status set default 'draft'::public.event_status;
drop type public.event_status_with_archived;

-- As in 20261027230346.
create function public.event_is_public(p_status public.event_status, p_publish_at timestamptz)
returns boolean
language sql stable set search_path = '' as $$
  select p_status = 'active'::public.event_status;
$$;

revoke all on function public.event_is_public(public.event_status, timestamptz) from public;
grant execute on function public.event_is_public(public.event_status, timestamptz)
  to anon, authenticated, service_role;

alter table public.events add constraint events_publish_schedule_requires_draft
  check (publish_at is null or status = 'draft');

create index events_pending_publication_idx on public.events (publish_at)
  where status = 'draft' and publish_at is not null;

-- As in 20261027230347 and 20261028203550.
create trigger lock_event_publication_schedule
before insert or delete or update of status, publish_at on public.events
for each statement execute function public.lock_event_publication_schedule();

create trigger reschedule_event_publication_after_write
after insert or delete or update of status, publish_at on public.events
for each statement execute function public.reschedule_event_publication_after_write();

create trigger sync_event_publication_watchdog
after insert or delete or update of status, publish_at on public.events
for each statement execute function event_publication.sync_watchdog();

-- As in 20261015000006.
create policy "everyone can view active events"
on public.events
for select
to anon, authenticated
using (public.event_is_public(status, publish_at));

create policy "public can view mentors for active events"
on public.mentors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.event_mentors event_mentor
    join public.events event on event.id = event_mentor.event_id
    where event_mentor.mentor_id = mentors.id
      and public.event_is_public(event.status, event.publish_at)
  )
);

create policy "public can view sponsors for active events"
on public.sponsors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.event_sponsors event_sponsor
    join public.events event on event.id = event_sponsor.event_id
    where event_sponsor.sponsor_id = sponsors.id
      and public.event_is_public(event.status, event.publish_at)
  )
);

create policy "public can view mentor links for active events"
on public.event_mentors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_mentors.event_id
      and public.event_is_public(event.status, event.publish_at)
  )
);

create policy "public can view sponsor links for active events"
on public.event_sponsors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_sponsors.event_id
      and public.event_is_public(event.status, event.publish_at)
  )
);

-- As in 20270101000008.
create policy "applications: insert own"
on public.event_applications
for insert
to authenticated
with check (
  user_id = public.current_user_info_id()
  and status = 'submitted'
  and offer_expires_at is null
  and exists (
    select 1
    from public.events event
    where event.id = event_applications.event_id
      and event.requires_application
      and (public.event_is_public(event.status, event.publish_at) or public.is_admin())
      and (event.registration_opens_at is null or now() >= event.registration_opens_at)
      and (event.registration_closes_at is null or now() <= event.registration_closes_at)
  )
);

-- ── Policies on the legacy schema ────────────────────────────────────────
--
-- Both are from 20260727030000. Questions are readable by applicants, and by
-- members while a public event's registration is open; that window used to
-- ignore the event's status. Check-in sessions are readable by ticket holders.

drop policy "application questions: applicants read" on public.event_application_questions;
create policy "application questions: applicants read"
on public.event_application_questions
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.event_applications application
    where application.event_id = event_application_questions.event_id
      and application.user_id = public.current_user_info_id()
  )
  or exists (
    select 1
    from public.events event
    where event.id = event_application_questions.event_id
      and public.event_is_public(event.status, event.publish_at)
      and now() >= coalesce(event.registration_opens_at, '-infinity'::timestamptz)
      and now() <= coalesce(event.registration_closes_at, 'infinity'::timestamptz)
  )
);

drop policy "check-in sessions: registered users read" on public.check_in_sessions;
create policy "check-in sessions: registered users read"
on public.check_in_sessions
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.event_tickets ticket
    where ticket.event_id = check_in_sessions.event_id
      and ticket.user_id = public.current_user_info_id()
  )
);

-- ── Check-ins and responses: required ticket and application ────────────
--
-- The backfill links a check-in or response whose registration became a
-- ticket or application with the same id. One whose person already had a
-- ticket or application under another id (written by the step 2 code) is
-- linked to that one here, unless it would duplicate an existing row.
--
-- What is left cannot be linked and is deleted:
--   - a check-in whose registration was never attending. The legacy check-in
--     page listed only attending registrations, so this needs a registration
--     that stopped attending after its check-in, and the person has no ticket
--     to check in with;
--   - a response on an event that takes no applications (the backfill makes
--     applications only for applications_enabled events). Nothing shows a
--     response without its application.

update public.check_ins check_in
set ticket_id = ticket.id
from public.event_registrations registration
join public.event_tickets ticket
  on ticket.event_id = registration.event_id
 and ticket.user_id = registration.user_id
where check_in.ticket_id is null
  and registration.id = check_in.event_registration_id
  and not exists (
    select 1
    from public.check_ins other
    where other.ticket_id = ticket.id
      and other.check_in_session_id = check_in.check_in_session_id
  );

delete from public.check_ins where ticket_id is null;

update public.event_application_responses response
set application_id = application.id
from public.event_registrations registration
join public.event_applications application
  on application.event_id = registration.event_id
 and application.user_id = registration.user_id
where response.application_id is null
  and registration.id = response.event_registration_id
  and not exists (
    select 1
    from public.event_application_responses other
    where other.application_id = application.id
      and other.event_application_question_id = response.event_application_question_id
  );

delete from public.event_application_responses where application_id is null;

alter table public.check_ins alter column ticket_id set not null;
alter table public.event_application_responses alter column application_id set not null;

-- Superseded by the "… own application" policies of 20270101000008.
drop policy "application responses: read own" on public.event_application_responses;
drop policy "application responses: insert own" on public.event_application_responses;
drop policy "application responses: update own" on public.event_application_responses;
drop policy "application responses: delete own" on public.event_application_responses;

-- Drops the column's foreign key, its index and its unique key with it.
alter table public.check_ins drop column event_registration_id;
alter table public.event_application_responses drop column event_registration_id;

-- ── Legacy functions and the registrations table ─────────────────────────

drop trigger sync_legacy_event_columns on public.events;
drop function public.sync_legacy_event_columns();
drop function public.legacy_event_ends_at(date, time, date, time);
drop function public.legacy_event_starts_at(date, time);
drop function public.backfill_event_tickets_and_applications();

-- Nothing sets the setting now that the backfill is gone.
create or replace function public.check_event_application_transition()
returns trigger
language plpgsql set search_path = '' as $$
declare
  v_allowed boolean;
begin
  if new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'An application cannot move to another event or person.'
      using errcode = 'check_violation';
  end if;

  v_allowed := case old.status
    when 'submitted' then true
    when 'waitlisted' then new.status in ('waitlisted', 'accepted', 'rejected')
    when 'accepted' then new.status in ('accepted', 'rejected')
    when 'rejected' then new.status = 'rejected'
  end;

  if not v_allowed then
    raise exception 'An application cannot go from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if old.status = 'accepted' and new.status = 'rejected' and exists (
    select 1
    from public.event_tickets ticket
    where ticket.event_id = new.event_id
      and ticket.user_id = new.user_id
  ) then
    raise exception 'This applicant already has a ticket, so the offer cannot be taken back.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop function public.reserve_paid_event_ticket(uuid, uuid, uuid);
drop function public.release_paid_event_ticket_reservation(uuid);
drop function public.event_registration_counts(uuid[]);
-- A waitlist trigger function on event_registrations from the initial schema
-- (20260111032511). No trigger has ever called it.
drop function public.promote_from_waitlist();

-- Its own policies, trigger and realtime membership go with it.
drop table public.event_registrations;
drop type public.application_status;

-- ── Legacy events columns ────────────────────────────────────────────────
--
-- events_check and events_check1 cover only these columns and go with them.

alter table public.events
  drop column start_date,
  drop column start_time,
  drop column end_date,
  drop column end_time,
  drop column registration_start_time,
  drop column registration_end_time,
  drop column applications_enabled;
