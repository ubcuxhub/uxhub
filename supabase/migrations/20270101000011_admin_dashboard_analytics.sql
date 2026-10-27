-- Live dashboard summaries. Explicitly authorize before reading as owner:
-- legacy check-in SELECT policies exclude managers even though they have
-- dashboard access. Return only aggregates, never source rows. A single JSON
-- object also avoids truncating totals at PostgREST's response row cap.
create function public.admin_membership_analytics(p_now timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  with members as (
    select u.membership_type_id, count(*) as member_count
    from public.user_info u
    where u.deleted_at is null and u.membership_type_id is not null
      and (u.membership_expires_at is null or u.membership_expires_at > p_now)
      and not exists (
        select 1 from public.app_settings s
        where s.membership_term_ends_at <= p_now
      )
    group by u.membership_type_id
  ), tiers as (
    select t.id, t.name, t.price, coalesce(m.member_count, 0) as member_count
    from public.membership_types t
    left join members m on m.membership_type_id = t.id
    where t.active or coalesce(m.member_count, 0) > 0
  )
  select jsonb_build_object(
    'activeMembers', coalesce((select sum(member_count) from members), 0),
    'buyersLast30Days', (
      select count(distinct p.user_id) from public.purchases p
      where p.kind = 'membership' and p.status = 'completed'
        and p.fulfilled_at >= p_now - interval '720 hours'
        and p.fulfilled_at <= p_now
    ),
    'tiers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'count', member_count
    ) order by price, name, id) from tiers), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function public.admin_event_analytics(p_now timestamptz default now())
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
    select e.id, e.name, e.starts_at from public.events e
    where e.status = 'active' and e.starts_at is not null
      and (e.publish_at is null or e.publish_at <= p_now)
  ), registrations as (
    select r.event_id, count(*) as total
    from public.event_registrations r join published e on e.id = r.event_id
    where r.attending = true group by r.event_id
  ), checked_in as materialized (
    select distinct r.event_id, r.user_id
    from public.event_registrations r
    join published e on e.id = r.event_id
    join public.check_ins c on c.event_registration_id = r.id
    join public.check_in_sessions s on s.id = c.check_in_session_id and s.event_id = e.id
    where c.checked_in_at is not null and r.attending = true
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
      from summaries where starts_at > p_now order by starts_at, id limit 1),
    'schoolYearLabel', school_start_year::text || '–' || (school_start_year + 1)::text,
    'uniqueParticipants', (select count(distinct c.user_id)
      from checked_in c join published e on e.id = c.event_id
      where e.starts_at >= school_start and e.starts_at < school_end)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_membership_analytics(timestamptz) from public, anon;
revoke all on function public.admin_event_analytics(timestamptz) from public, anon;
grant execute on function public.admin_membership_analytics(timestamptz) to authenticated;
grant execute on function public.admin_event_analytics(timestamptz) to authenticated;

comment on function public.admin_membership_analytics(timestamptz) is
  'Admin-only active members by tier and distinct fulfilled membership buyers over the rolling last 30 days.';
comment on function public.admin_event_analytics(timestamptz) is
  'Admin-only published event registration/attendance totals and distinct September–April participants in Vancouver time.';
