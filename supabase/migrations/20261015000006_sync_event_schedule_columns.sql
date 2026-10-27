-- Keeps the new event columns in step with the legacy ones the deployed code
-- writes, and hides scheduled events with their people.
--
-- 20270101000001 added publish_at, starts_at, ends_at, registration_opens_at
-- and registration_closes_at with a one-off backfill, so they went stale on
-- the next legacy write, and left ends_at empty without an end time.
-- requires_application, renamed back in 20270101000005, returns as its own
-- column. A trigger copies each legacy write into the new columns until the
-- code moves over; the legacy columns, their helpers and the trigger are
-- dropped once nothing reads them (see docs/registration-rollout.md).

alter table public.events
  add column requires_application boolean not null default false;

-- Legacy dates and times are Vancouver wall-clock values.
create function public.legacy_event_starts_at(p_start_date date, p_start_time time)
returns timestamptz
language sql stable set search_path = '' as $$
  select (p_start_date + coalesce(p_start_time, time '00:00'))
    at time zone 'America/Vancouver';
$$;

-- An event without an end date ends on its start date, and one without an end
-- time ends at the end of that day, so every dated event eventually counts as
-- past. Never earlier than the start.
create function public.legacy_event_ends_at(
  p_start_date date, p_start_time time, p_end_date date, p_end_time time
)
returns timestamptz
language sql stable set search_path = '' as $$
  select greatest(
    (coalesce(p_end_date, p_start_date) + coalesce(p_end_time, time '23:59:59'))
      at time zone 'America/Vancouver',
    public.legacy_event_starts_at(p_start_date, p_start_time)
  );
$$;

revoke all on function public.legacy_event_starts_at(date, time) from public, anon, authenticated;
revoke all on function public.legacy_event_ends_at(date, time, date, time) from public, anon, authenticated;

-- Copies a legacy column into its replacement when a write changes the legacy
-- one and leaves the replacement alone, so a writer of either kind wins.
create function public.sync_legacy_event_columns()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.starts_at := coalesce(new.starts_at,
      public.legacy_event_starts_at(new.start_date, new.start_time));
    new.ends_at := coalesce(new.ends_at,
      public.legacy_event_ends_at(new.start_date, new.start_time, new.end_date, new.end_time));
    new.registration_opens_at := coalesce(new.registration_opens_at, new.registration_start_time);
    new.registration_closes_at := coalesce(new.registration_closes_at, new.registration_end_time);
    new.requires_application := new.requires_application or new.applications_enabled;
    return new;
  end if;

  if (new.start_date, new.start_time) is distinct from (old.start_date, old.start_time)
     and new.starts_at is not distinct from old.starts_at then
    new.starts_at := public.legacy_event_starts_at(new.start_date, new.start_time);
  end if;

  if (new.start_date, new.start_time, new.end_date, new.end_time)
       is distinct from (old.start_date, old.start_time, old.end_date, old.end_time)
     and new.ends_at is not distinct from old.ends_at then
    new.ends_at := public.legacy_event_ends_at(
      new.start_date, new.start_time, new.end_date, new.end_time);
  end if;

  if new.registration_start_time is distinct from old.registration_start_time
     and new.registration_opens_at is not distinct from old.registration_opens_at then
    new.registration_opens_at := new.registration_start_time;
  end if;

  if new.registration_end_time is distinct from old.registration_end_time
     and new.registration_closes_at is not distinct from old.registration_closes_at then
    new.registration_closes_at := new.registration_end_time;
  end if;

  if new.applications_enabled is distinct from old.applications_enabled
     and new.requires_application is not distinct from old.requires_application then
    new.requires_application := new.applications_enabled;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_legacy_event_columns() from public, anon, authenticated;

create trigger sync_legacy_event_columns
before insert or update on public.events
for each row execute function public.sync_legacy_event_columns();

-- Re-derive every row, without bumping updated_at.
alter table public.events disable trigger update_events_updated_at;

update public.events
set
  starts_at              = public.legacy_event_starts_at(start_date, start_time),
  ends_at                = public.legacy_event_ends_at(start_date, start_time, end_date, end_time),
  registration_opens_at  = registration_start_time,
  registration_closes_at = registration_end_time,
  requires_application   = applications_enabled;

alter table public.events enable trigger update_events_updated_at;

-- 20270101000001's events_ends_at_gte_starts_at and
-- events_registration_closes_at_gte_opens_at already guard the new columns.

-- What members see: active, and either unscheduled or past its publish time
-- (docs/event-states.md). Admins and managers keep seeing every event through
-- admin_select_all_events.
create function public.event_is_public(p_status public.event_status, p_publish_at timestamptz)
returns boolean
language sql stable set search_path = '' as $$
  select p_status = 'active'::public.event_status
    and (p_publish_at is null or p_publish_at <= now());
$$;

revoke all on function public.event_is_public(public.event_status, timestamptz) from public;
grant execute on function public.event_is_public(public.event_status, timestamptz)
  to anon, authenticated, service_role;

drop policy "everyone can view active events" on public.events;
create policy "everyone can view active events"
on public.events
for select
to anon, authenticated
using (public.event_is_public(status, publish_at));

drop policy "public can view mentors for active events" on public.mentors;
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

drop policy "public can view sponsors for active events" on public.sponsors;
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

drop policy "public can view mentor links for active events" on public.event_mentors;
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

drop policy "public can view sponsor links for active events" on public.event_sponsors;
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
