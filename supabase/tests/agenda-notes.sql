-- Within rls.sql's rolled-back transaction.
do $$
declare eid uuid; did uuid; iid uuid;
begin
  insert into public.events(name,slug,status) values('Agenda notes RLS','notes-rls-'||gen_random_uuid(),'draft') returning id into eid;
  insert into public.event_agenda_days(event_id,date,title) values(eid,'2027-12-01','Day') returning id into did;
  insert into public.event_agenda_items(event_agenda_day_id,title,start_time,end_time) values(did,'Item','09:00','10:00') returning id into iid;
  insert into public.event_agenda_notes(item_id,body,revision) values(iid,'Private staff note',1);
  perform set_config('rls.agenda_note_item',iid::text,true);
  perform set_config('rls.agenda_note_event',eid::text,true);
  if has_table_privilege('anon','public.event_agenda_notes','select') then raise exception 'anonymous can read notes'; end if;
  if has_table_privilege('authenticated','public.event_agenda_notes','insert')
    or has_table_privilege('authenticated','public.event_agenda_notes','update')
    or has_table_privilege('authenticated','public.event_agenda_notes','delete') then raise exception 'browser can bypass note revisions'; end if;
  if has_function_privilege('anon','public.save_agenda_note(uuid,uuid,text,integer)','execute') then raise exception 'anonymous can execute note saves'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'user_c_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.event_agenda_notes where item_id=current_setting('rls.agenda_note_item')::uuid) then raise exception 'basic user read notes'; end if;
  begin
    perform public.save_agenda_note(current_setting('rls.agenda_note_event')::uuid,current_setting('rls.agenda_note_item')::uuid,'Overwrite',1);
    raise exception 'basic user wrote notes';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
