-- Content editor documents are staff-only; browser writes cannot bypass saves.
select set_config('request.jwt.claims', json_build_object('sub', :'user_c_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.event_content_settings) then raise exception 'basic user read staff event content'; end if;
  if has_table_privilege('authenticated','public.event_content_settings','insert') or has_table_privilege('authenticated','public.event_content_settings','update') then raise exception 'browser can write editor content'; end if;
  if has_function_privilege('authenticated','public.save_admin_event_atomically(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb)','execute') then raise exception 'browser can mutate people/resources'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if has_table_privilege('anon','public.event_content_settings','select') then raise exception 'anonymous can read staff editor content'; end if;
  if has_function_privilege('anon','public.save_admin_event_before_content(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb)','execute') then raise exception 'anonymous can invoke legacy content save'; end if;
end $$;
reset role;
