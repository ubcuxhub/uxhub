-- This file runs inside rls.sql's rolled-back transaction.
do $$
declare eid uuid;
begin
 insert into public.events(name,slug,status,starts_at,ends_at)
 values('Staff resource RLS','staff-resource-rls-'||gen_random_uuid(),'draft',now(),now()+interval '1 hour') returning id into eid;
 insert into public.event_staff_volunteer_schedules(event_id,url) values(eid,'https://example.test/staff-private');
 perform set_config('rls.staff_schedule_event',eid::text,true);
 if has_table_privilege('anon','public.event_staff_volunteer_schedules','select') then raise exception 'anonymous can read staff schedules'; end if;
 if has_table_privilege('authenticated','public.event_staff_volunteer_schedules','insert')
  or has_table_privilege('authenticated','public.event_staff_volunteer_schedules','update')
  or has_table_privilege('authenticated','public.event_staff_volunteer_schedules','delete') then raise exception 'browser can mutate staff schedules'; end if;
 if has_function_privilege('authenticated','public.sync_staff_schedule_content()','execute')
  or has_function_privilege('anon','public.save_past_event_resources(uuid,integer,jsonb,uuid,integer)','execute')
  or has_function_privilege('authenticated','public.save_past_event_resources(uuid,integer,jsonb,uuid,integer)','execute') then raise exception 'browser can bypass staff schedule writes'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'user_c_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_staff_volunteer_schedules where event_id=current_setting('rls.staff_schedule_event')::uuid) then raise exception 'basic user read a staff URL'; end if;
end $$;
reset role;
