-- AEB-034 aggregate reads must not reveal team counts to nonstaff; mutation
-- RPCs and direct team writes stay service-role only.
select set_config('request.jwt.claims', json_build_object('sub', :'user_c_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.admin_event_team_settings(null);
    raise exception 'basic user read staff team counts';
  exception when raise_exception then
    if sqlerrm <> 'Staff access required.' then raise; end if;
  end;
  if has_function_privilege('authenticated', 'public.save_admin_event_atomically(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'browser can mutate team settings through save RPC';
  end if;
  begin
    update public.teams set name = 'unauthorized';
    raise exception 'browser changed a team';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.team_members;
    raise exception 'browser deleted team memberships';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  if has_function_privilege('anon', 'public.admin_event_team_settings(uuid)', 'execute') then
    raise exception 'anonymous can read staff team counts';
  end if;
end $$;
reset role;
