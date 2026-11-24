-- Dashboard registrations now come from tickets; check-ins link by ticket_id.
-- Replace the function in place to preserve its signature, ownership and grants.
create or replace function public.admin_event_analytics(p_now timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  local_year integer := extract(year from p_now at time zone 'America/Vancouver');
  school_start_year integer := local_year - case
    when extract(month from p_now at time zone 'America/Vancouver') < 9 then 1 else 0 end;
  school_start timestamptz := make_date(school_start_year, 9, 1)::timestamp at time zone 'America/Vancouver';
  school_end timestamptz := make_date(school_start_year + 1, 5, 1)::timestamp at time zone 'America/Vancouver';
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  with published as materialized (
    select e.id, e.name, e.starts_at, e.ends_at from public.events e
    where e.status = 'active' and e.starts_at is not null
  ), registrations as (
    select r.event_id, count(*) as total
    from public.event_tickets r join published e on e.id = r.event_id
    group by r.event_id
  ), checked_in as materialized (
    select distinct r.event_id, r.user_id
    from public.event_tickets r
    join published e on e.id = r.event_id
    join public.check_ins c on c.ticket_id = r.id
    join public.check_in_sessions s on s.id = c.check_in_session_id and s.event_id = e.id
    where c.checked_in_at is not null
  ), attendance as (
    select event_id, count(*) as total from checked_in group by event_id
  ), summaries as materialized (
    select e.*, coalesce(r.total, 0) as registrations, coalesce(a.total, 0) as attendees
    from published e
    left join registrations r on r.event_id = e.id
    left join attendance a on a.event_id = e.id
  )
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'startsAt', starts_at,
      'registrations', registrations, 'attendees', attendees
    ) order by starts_at, id) from summaries), '[]'::jsonb),
    'currentEvent', (select jsonb_build_object('id', id, 'name', name, 'registrations', registrations)
      from summaries where coalesce(ends_at, starts_at) > p_now order by starts_at, id limit 1),
    'schoolYearLabel', school_start_year::text || '–' || (school_start_year + 1)::text,
    'uniqueParticipants', (select count(distinct c.user_id)
      from checked_in c join published e on e.id = c.event_id
      where e.starts_at >= school_start and e.starts_at < school_end)
  ) into result;
  return result;
end;
$$;

