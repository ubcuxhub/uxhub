-- Editor settings never enter a public projection, including inactive values.
insert into public.event_date_location_settings(event_id, document)
values (:'draft_event_id', '{"location":{"meeting_passcode":"PRIVATE-EDITOR-VALUE"},"dates":[]}'::jsonb);
set local role anon;
do $$ begin
  if has_table_privilege('anon', 'public.event_date_location_settings', 'select') then
    raise exception 'anonymous can read private editor settings';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'user_c_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.event_date_location_settings) then
    raise exception 'basic user can read private editor settings';
  end if;
  if has_table_privilege('authenticated', 'public.event_date_location_settings', 'insert,update,delete') then
    raise exception 'browser roles can write editor settings';
  end if;
end $$;
reset role;
