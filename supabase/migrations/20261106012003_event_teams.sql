-- Teams for team events (Figma "Teams" workflow, 7.1–7.11).
--
-- A student who holds a ticket creates a team, which gives it an invite code,
-- or joins one through a teammate's code. A student is on at most one team per
-- event. The team's owner can delete it; any other member can leave. At the
-- event's team deadline teams lock, and admins place whoever has no team; an
-- admin-made team may have no owner.
--
-- Students change teams only through the functions below, which the server
-- calls with the service-role client, as it calls reserve_event_ticket. They
-- check the ticket, the deadline and the size limit, and lock the team so two
-- people can't both take its last spot. Each returns a failure reason instead
-- of raising, for the page to show.

-- ── events: team settings ───────────────────────────────────────────────

alter table public.events
  add column teams_enabled boolean not null default false,
  -- Null means no limit.
  add column min_team_size integer,
  add column max_team_size integer,
  -- Null means teams never lock.
  add column team_deadline timestamptz,
  add constraint events_min_team_size_check
    check (min_team_size is null or min_team_size >= 1),
  add constraint events_max_team_size_check
    check (max_team_size is null or max_team_size >= 1),
  add constraint events_team_size_range_check
    check (min_team_size is null or max_team_size is null or min_team_size <= max_team_size);

-- ── teams ───────────────────────────────────────────────────────────────

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  -- Optional at creation (7.1).
  name text check (name is null or btrim(name) <> ''),
  -- The code in the invite link, e.g. ubcuxhub.ca/join/<code>.
  invite_code text not null unique default encode(extensions.gen_random_bytes(5), 'hex'),
  -- Null for a team admins made after the deadline.
  owner_id uuid references public.user_info(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The target of team_members' (team_id, event_id) key.
  unique (id, event_id)
);

create index teams_event_id_idx on public.teams (event_id);

create trigger update_teams_updated_at
  before update on public.teams
  for each row execute function public.update_updated_at_column();

-- One row per student per event, so nobody is on two teams for one event.
-- event_id repeats the team's own, and the composite key keeps them equal.
create table public.team_members (
  event_id uuid not null,
  team_id uuid not null,
  user_id uuid not null references public.user_info(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (team_id, event_id)
    references public.teams (id, event_id)
    on delete cascade
);

create index team_members_team_id_idx on public.team_members (team_id, joined_at);

-- ── RLS ─────────────────────────────────────────────────────────────────
--
-- Students read their own team and its members; admins and managers read
-- every team. Nobody writes through the API: the functions below do, as the
-- service role.

-- The teams the signed-in student is on. Security definer so the policies
-- below can ask without recursing into team_members' own policy.
create function public.current_user_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.team_id
  from public.team_members member
  where member.user_id = public.current_user_info_id();
$$;

revoke all on function public.current_user_team_ids() from public, anon;
grant execute on function public.current_user_team_ids() to authenticated, service_role;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "members can view their team"
on public.teams
for select
to authenticated
using (id in (select public.current_user_team_ids()));

create policy "admins can view all teams"
on public.teams
for select
to authenticated
using (public.is_admin());

create policy "members can view their teammates"
on public.team_members
for select
to authenticated
using (team_id in (select public.current_user_team_ids()));

create policy "admins can view all team members"
on public.team_members
for select
to authenticated
using (public.is_admin());

-- Supabase grants every privilege on new public tables by default; take the
-- write privileges back so the browser roles are read-only, not just filtered.
revoke all on public.teams from anon, authenticated;
revoke all on public.team_members from anon, authenticated;
grant select on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant all on public.teams to service_role;
grant all on public.team_members to service_role;

-- ── Team actions ────────────────────────────────────────────────────────

-- Why p_user_id can't change teams for this event right now, or null if it
-- can: the event runs teams, they hold a ticket, and teams haven't locked.
create function public.team_change_blocked(p_event_id uuid, p_user_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    return 'EVENT_NOT_FOUND';
  end if;
  if not v_event.teams_enabled then
    return 'TEAMS_DISABLED';
  end if;
  if not exists (
    select 1 from public.event_tickets
    where event_id = p_event_id and user_id = p_user_id
  ) then
    return 'NO_TICKET';
  end if;
  if v_event.team_deadline is not null and now() >= v_event.team_deadline then
    return 'TEAMS_LOCKED';
  end if;
  return null;
end;
$$;

-- Creates a team owned by p_user_id, with them as its first member.
create function public.create_team(p_event_id uuid, p_user_id uuid, p_name text default null)
returns table (team_id uuid, failure_reason text)
language plpgsql
set search_path = ''
as $$
declare
  v_blocked text := public.team_change_blocked(p_event_id, p_user_id);
  v_team_id uuid;
begin
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
create function public.join_team(p_invite_code text, p_user_id uuid)
returns table (team_id uuid, failure_reason text)
language plpgsql
set search_path = ''
as $$
declare
  v_team public.teams;
  v_blocked text;
  v_max integer;
begin
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

-- Takes p_user_id off their team for this event. The owner deletes the team
-- instead (7.4); members leave (7.9). Returns null on success.
create function public.leave_team(p_event_id uuid, p_user_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_blocked text := public.team_change_blocked(p_event_id, p_user_id);
  v_team public.teams;
begin
  if v_blocked is not null then
    return v_blocked;
  end if;

  select team.* into v_team
  from public.team_members member
  join public.teams team on team.id = member.team_id
  where member.event_id = p_event_id and member.user_id = p_user_id;
  if not found then
    return 'NOT_ON_TEAM';
  end if;
  if v_team.owner_id = p_user_id then
    return 'OWNER_CANNOT_LEAVE';
  end if;

  delete from public.team_members
  where event_id = p_event_id and user_id = p_user_id;
  return null;
end;
$$;

-- Deletes a team and removes everyone on it (7.4). Only its owner can, and
-- only before teams lock. Returns null on success.
create function public.delete_team(p_team_id uuid, p_user_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_team public.teams;
  v_blocked text;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then
    return 'TEAM_NOT_FOUND';
  end if;
  if v_team.owner_id is distinct from p_user_id then
    return 'NOT_OWNER';
  end if;

  v_blocked := public.team_change_blocked(v_team.event_id, p_user_id);
  if v_blocked is not null then
    return v_blocked;
  end if;

  delete from public.teams where id = p_team_id;
  return null;
end;
$$;

-- The server calls these as the service role, passing the signed-in user.
revoke all on function public.team_change_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_team(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.join_team(text, uuid) from public, anon, authenticated;
revoke all on function public.leave_team(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_team(uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_change_blocked(uuid, uuid) to service_role;
grant execute on function public.create_team(uuid, uuid, text) to service_role;
grant execute on function public.join_team(text, uuid) to service_role;
grant execute on function public.leave_team(uuid, uuid) to service_role;
grant execute on function public.delete_team(uuid, uuid) to service_role;
