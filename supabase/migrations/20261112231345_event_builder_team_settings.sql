-- AEB-034: team configuration uses existing columns. Serialize settings and
-- creation/growth on the event row; never delete team or historical records.
create function public.admin_event_team_settings(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' and not coalesce(public.is_admin(), false) then
    raise exception 'Staff access required.';
  end if;
  return (select jsonb_build_object('team_count', count(*), 'largest_team', coalesce(max(members), 0))
    from (select t.id, count(m.user_id) members from public.teams t
      left join public.team_members m on m.team_id = t.id
      where t.event_id = p_event_id group by t.id) sizes);
end $$;
revoke all on function public.admin_event_team_settings(uuid) from public, anon;
grant execute on function public.admin_event_team_settings(uuid) to authenticated, service_role;

create function public.guard_event_team_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_largest integer;
begin
  if tg_op = 'INSERT' then
    if new.team_deadline is not null and not isfinite(new.team_deadline) then
      raise exception 'Team deadline requires a finite date and time.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    return new;
  end if;
  if (new.teams_enabled, new.min_team_size, new.max_team_size, new.team_deadline)
    is not distinct from (old.teams_enabled, old.min_team_size, old.max_team_size, old.team_deadline) then return new; end if;
  if new.team_deadline is distinct from old.team_deadline and new.team_deadline is not null and not isfinite(new.team_deadline) then
    raise exception 'Team deadline requires a finite date and time.' using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  if not new.teams_enabled and exists(select 1 from public.teams where event_id = old.id) then
    raise exception 'Teams cannot be turned off because teams already exist.' using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  select coalesce(max(members), 0) into v_largest from (
    select count(*) members from public.team_members where event_id = old.id group by team_id
  ) sizes;
  if new.max_team_size is not null and new.max_team_size < v_largest then
    raise exception 'Maximum team size cannot be below %, the largest existing team.', v_largest using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  return new;
end $$;
create trigger guard_event_team_settings before insert or update on public.events
for each row execute function public.guard_event_team_settings();

-- These service-role write guards also cover future staff callers. They impose
-- no new attendee ownership/deadline or under-minimum policy.
create function public.guard_team_settings_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event public.events; v_count integer;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'teams' then
      if new.event_id = old.event_id then return new; end if;
    else
      if (new.event_id, new.team_id) = (old.event_id, old.team_id) then return new; end if;
    end if;
    if new.event_id <> old.event_id then
      raise exception 'Teams and memberships cannot move between events.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
  end if;
  select * into v_event from public.events where id = new.event_id for update;
  if not v_event.teams_enabled then
    raise exception 'Teams are disabled for this event.' using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  if tg_table_name = 'team_members' and v_event.max_team_size is not null then
    select count(*) into v_count from public.team_members where team_id = new.team_id;
    if v_count >= v_event.max_team_size then
      raise exception 'This team is full.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
  end if;
  return new;
end $$;
create trigger guard_team_creation before insert or update on public.teams
for each row execute function public.guard_team_settings_membership();
create trigger guard_team_growth before insert or update on public.team_members
for each row execute function public.guard_team_settings_membership();

create or replace function public.create_team(p_event_id uuid, p_user_id uuid, p_name text default null)
returns table (team_id uuid, failure_reason text)
language plpgsql
set search_path = ''
as $$
declare
  v_blocked text;
  v_team_id uuid;
begin
  perform 1 from public.events where id = p_event_id for update;
  v_blocked := public.team_change_blocked(p_event_id, p_user_id);
  if v_blocked is not null then
    return query select null::uuid, v_blocked;
    return;
  end if;

  begin
    insert into public.teams (event_id, name, owner_id)
    values (p_event_id, nullif(btrim(p_name), ''), p_user_id)
    returning id into v_team_id;

    insert into public.team_members (event_id, team_id, user_id)
    values (p_event_id, v_team_id, p_user_id);
  exception
    -- Already on a team for this event; the team insert is undone with it.
    when unique_violation then
      return query select null::uuid, 'ALREADY_ON_TEAM'::text;
      return;
  end;

  return query select v_team_id, null::text;
end;
$$;

-- Adds p_user_id to the team with this invite code, if it has room.
create or replace function public.join_team(p_invite_code text, p_user_id uuid)
returns table (team_id uuid, failure_reason text)
language plpgsql
set search_path = ''
as $$
declare
  v_team public.teams;
  v_blocked text;
  v_max integer;
begin
  perform 1 from public.events where id = (
    select event_id from public.teams where invite_code = btrim(p_invite_code)
  ) for update;
  -- Locked, so two people joining at once can't both take the last spot.
  select * into v_team
  from public.teams
  where invite_code = btrim(p_invite_code)
  for update;
  if not found then
    return query select null::uuid, 'TEAM_NOT_FOUND'::text;
    return;
  end if;

  v_blocked := public.team_change_blocked(v_team.event_id, p_user_id);
  if v_blocked is not null then
    return query select null::uuid, v_blocked;
    return;
  end if;

  if exists (
    select 1 from public.team_members
    where event_id = v_team.event_id and user_id = p_user_id
  ) then
    return query select null::uuid, 'ALREADY_ON_TEAM'::text;
    return;
  end if;

  select max_team_size into v_max from public.events where id = v_team.event_id;
  if v_max is not null and (
    select count(*) from public.team_members where team_members.team_id = v_team.id
  ) >= v_max then
    return query select null::uuid, 'TEAM_FULL'::text;
    return;
  end if;

  begin
    insert into public.team_members (event_id, team_id, user_id)
    values (v_team.event_id, v_team.id, p_user_id);
  exception
    when unique_violation then
      return query select null::uuid, 'ALREADY_ON_TEAM'::text;
      return;
  end;

  return query select v_team.id, null::text;
end;
$$;


revoke all on function public.guard_event_team_settings() from public, anon, authenticated;
revoke all on function public.guard_team_settings_membership() from public, anon, authenticated;
