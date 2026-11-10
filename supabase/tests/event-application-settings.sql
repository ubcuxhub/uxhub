-- Provisional release/deadline configuration is staff-only; no browser role
-- can overwrite timing or clear the durable submitted-question lock.
insert into public.event_application_settings(event_id, decisions_release_at, confirmation_deadline)
values (:'draft_event_id', now(), now() + interval '1 day')
on conflict(event_id) do update set decisions_release_at = excluded.decisions_release_at, confirmation_deadline = excluded.confirmation_deadline;
set local role anon;
do $$ begin
  if has_table_privilege('anon', 'public.event_application_settings', 'select') then
    raise exception 'anonymous can read application settings';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'user_c_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.event_application_settings) then
    raise exception 'basic user can read application settings';
  end if;
  if has_table_privilege('authenticated', 'public.event_application_settings', 'insert,update,delete') then
    raise exception 'browser roles can change application settings';
  end if;
  begin
    update public.event_application_settings set questions_locked_at = null;
    raise exception 'browser cleared application lock';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege('authenticated', 'public.save_event_application_questions(uuid,jsonb)', 'execute') then
    raise exception 'browser can bypass question save authorization';
  end if;
end $$;
reset role;
