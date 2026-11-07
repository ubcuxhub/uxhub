-- Working documents have no anonymous access and no browser-role mutations.
do $$
begin
  if has_table_privilege('anon', 'public.admin_event_drafts', 'select') then raise exception 'Anonymous visitors can read incomplete working documents'; end if;
  if not has_table_privilege('authenticated', 'public.admin_event_drafts', 'select') then raise exception 'Staff draft read grant missing'; end if;
  if has_table_privilege('authenticated', 'public.admin_event_drafts', 'insert,update,delete') then raise exception 'Browser role can mutate draft documents'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.admin_event_drafts'::regclass) then raise exception 'Draft RLS is disabled'; end if;
  if has_function_privilege('authenticated', 'public.save_admin_event_draft(uuid,uuid,jsonb,integer)', 'execute') or has_function_privilege('anon', 'public.save_admin_event_draft(uuid,uuid,jsonb,integer)', 'execute') then raise exception 'Draft save RPC exposed to browser'; end if;
end $$;
