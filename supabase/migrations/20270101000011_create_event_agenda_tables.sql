-- Per-day agenda for multi-day events. An event has at most one agenda day
-- per date, and each day holds timed items. An item's location falls back
-- to the event's own building and room when left blank.

create table public.event_agenda_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  date date not null,
  title text,
  unique (event_id, date)
);

create table public.event_agenda_items (
  id uuid primary key default gen_random_uuid(),
  event_agenda_day_id uuid not null references public.event_agenda_days(id) on delete cascade,
  title text not null,
  start_time time not null,
  end_time time not null,
  -- Each falls back on its own: a null building means the event's building,
  -- and a null room means the event's room.
  building text,
  room text,
  check (end_time > start_time)
);

create index on public.event_agenda_items (event_agenda_day_id, start_time);

-- Reads follow the parent event: anyone sees the agenda of an active event, and
-- admins and managers (`is_admin()`) see every agenda. There are no write
-- policies, so writes go through the service-role client like the rest of the
-- admin event save.
alter table public.event_agenda_days enable row level security;
alter table public.event_agenda_items enable row level security;

create policy "public can view agenda days for active events"
on public.event_agenda_days
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_agenda_days.event_id
      and event.status = 'active'::public.event_status
      and (event.publish_at is null or event.publish_at <= now())
  )
);

create policy "admins can view all agenda days"
on public.event_agenda_days
for select
to authenticated
using (public.is_admin());

create policy "public can view agenda items for active events"
on public.event_agenda_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.event_agenda_days agenda_day
    join public.events event on event.id = agenda_day.event_id
    where agenda_day.id = event_agenda_items.event_agenda_day_id
      and event.status = 'active'::public.event_status
      and (event.publish_at is null or event.publish_at <= now())
  )
);

create policy "admins can view all agenda items"
on public.event_agenda_items
for select
to authenticated
using (public.is_admin());

-- Supabase grants every privilege on new public tables by default; take the
-- write privileges back so the browser roles are read-only, not just filtered.
revoke all on public.event_agenda_days from anon, authenticated;
revoke all on public.event_agenda_items from anon, authenticated;
grant select on public.event_agenda_days to anon, authenticated;
grant select on public.event_agenda_items to anon, authenticated;
grant all on public.event_agenda_days to service_role;
grant all on public.event_agenda_items to service_role;
