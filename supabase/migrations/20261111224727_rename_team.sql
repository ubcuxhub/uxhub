-- Renaming a team. Like the other team actions in *_event_teams.sql, the
-- server calls it with the service-role client, passing the signed-in user.
-- Only the owner can rename, and only before teams lock. A blank name clears
-- it. Returns a failure reason, or null on success.

create function public.rename_team(p_team_id uuid, p_user_id uuid, p_name text)
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

  update public.teams
  set name = nullif(btrim(p_name), '')
  where id = p_team_id;
  return null;
end;
$$;

revoke all on function public.rename_team(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rename_team(uuid, uuid, text) to service_role;
