-- EAG-001 / D-08: empty-event cutover. No legacy attendance inference/backfill.
-- The staff document owns locations (including inactive fields). Public tables
-- contain timing, descriptions and audience-safe physical projections only.
alter table public.event_agenda_days add column starts_at timestamptz, add column ends_at timestamptz;
alter table public.event_agenda_items
  drop constraint event_agenda_items_check,
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column description text not null default '',
  add column check_in boolean not null default false,
  add constraint agenda_item_interval check (starts_at is null or ends_at > starts_at);
alter table public.check_in_sessions add column agenda_item_id uuid unique
  references public.event_agenda_items(id) on delete cascade;

create function public.agenda_pacific_instant(p_date text, p_time text)
returns timestamptz language plpgsql immutable set search_path='' as $$
declare wall timestamp; instant timestamptz;
begin
  if coalesce(p_date,'') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_time,'') !~ '^\d{2}:\d{2}$' then
    raise exception 'Agenda items require a valid date and time.' using hint='EVENT_SETTINGS_CONFLICT';
  end if;
  wall := (p_date || 'T' || p_time)::timestamp;
  instant := public.draft_event_timestamp(p_date || 'T' || p_time);
  if instant is null or to_char(wall,'YYYY-MM-DD"T"HH24:MI') <> p_date || 'T' || p_time or public.draft_event_wall_time(instant) <> wall
    or public.draft_event_wall_time(instant - interval '1 hour') = wall
    or public.draft_event_wall_time(instant + interval '1 hour') = wall then
    raise exception 'Use an unambiguous, valid Pacific time.' using hint='EVENT_SETTINGS_CONFLICT';
  end if;
  return instant;
end $$;
revoke all on function public.agenda_pacific_instant(text,text) from public,anon,authenticated;
grant execute on function public.agenda_pacific_instant(text,text) to service_role;

-- Session locks serialize deletion/disable with concurrent scanner inserts.
create function public.guard_agenda_attendance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='events' then
    perform 1 from public.check_in_sessions where event_id=old.id for update;
    if exists(select 1 from public.check_ins c join public.check_in_sessions s on s.id=c.check_in_session_id where s.event_id=old.id) then
      raise exception 'An event with attendance cannot be removed.' using hint='CHECK_IN_SESSIONS_CONFLICT';
    end if;
  elsif tg_table_name='check_in_sessions' then
    if tg_op='DELETE' or new.event_id is distinct from old.event_id or new.agenda_item_id is distinct from old.agenda_item_id then
      if exists(select 1 from public.check_ins where check_in_session_id=old.id) then
        raise exception 'An attended item cannot be removed or reassigned.' using hint='CHECK_IN_SESSIONS_CONFLICT';
      end if;
    end if;
  else
    perform 1 from public.check_in_sessions where agenda_item_id=old.id for update;
    if tg_op='DELETE' or not new.check_in or new.event_agenda_day_id is distinct from old.event_agenda_day_id then
      if exists(select 1 from public.check_ins c join public.check_in_sessions s on s.id=c.check_in_session_id where s.agenda_item_id=old.id) then
        raise exception 'An attended item cannot be removed or have check-in disabled.' using hint='CHECK_IN_SESSIONS_CONFLICT';
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.guard_agenda_attendance() from public,anon,authenticated;
create trigger guard_agenda_item_attendance before delete or update on public.event_agenda_items for each row execute function public.guard_agenda_attendance();
create trigger guard_agenda_session_attendance before delete or update on public.check_in_sessions for each row execute function public.guard_agenda_attendance();
create trigger guard_agenda_event_attendance before delete on public.events for each row execute function public.guard_agenda_attendance();

-- This seam sits inside application/content/publication/revision/receipt saves.
-- Existing callers without a v2 document retain their existing behavior.
alter function public.save_admin_event_before_application_settings(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb)
  rename to save_admin_event_before_agenda;
create function public.save_admin_event_before_application_settings(
  p_event_id uuid,p_event jsonb,p_slug text,p_expected_image_url text,
  p_check_in_sessions jsonb,p_application_questions jsonb,p_mentors jsonb,p_sponsors jsonb
) returns jsonb language plpgsql set search_path='' as $$
declare
  config jsonb:=p_event->'_date_location'; existing public.event_date_location_settings;
  day jsonb; item jsonb; location jsonb; day_location jsonb; days jsonb:='[]'; items jsonb;
  sessions jsonb:='[]'; result jsonb; eid uuid; sid uuid; idx integer:=0;
  first_start timestamptz; last_end timestamptz; day_start timestamptz; day_end timestamptz;
  item_start timestamptz; item_end timestamptz; all_keys uuid[]:='{}'; day_ids uuid[]:='{}'; item_ids uuid[]:='{}'; key uuid;
begin
  if config->>'version' is distinct from '2' then
    return public.save_admin_event_before_agenda(p_event_id,p_event,p_slug,p_expected_image_url,p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
  end if;
  if p_event_id is not null then
    perform 1 from public.events where id=p_event_id for update;
    select * into existing from public.event_date_location_settings where event_id=p_event_id;
  end if;
  if coalesce((p_event->>'_date_revision')::integer,0) <> coalesce(existing.revision,0) then
    raise exception 'Agenda changed in another tab. Reload before saving.' using hint='EVENT_SETTINGS_CONFLICT';
  end if;
  if coalesce(config->>'audience','') not in ('everyone','going') or jsonb_typeof(config->'dates') is distinct from 'array'
    or jsonb_array_length(config->'dates') not between 1 and 100 then
    raise exception 'Add valid agenda days and locations.' using hint='EVENT_SETTINGS_CONFLICT';
  end if;
  for day in select value from jsonb_array_elements(config->'dates') loop
    key:=(day->>'key')::uuid;
    if key is null or key=any(all_keys) or coalesce(btrim(day->>'label'),'')='' or jsonb_typeof(day->'items') is distinct from 'array' or jsonb_array_length(day->'items') not between 1 and 500 then
      raise exception 'Every day needs its own identity, a label and at least one item.' using hint='EVENT_SETTINGS_CONFLICT';
    end if;
    all_keys:=array_append(all_keys,key); day_ids:=array_append(day_ids,key);
    if exists(select 1 from public.event_agenda_days where id=key and event_id is distinct from p_event_id) then raise exception 'Agenda day belongs to another event.'; end if;
    day_start:=null; day_end:=null; items:='[]'; day_location:=day->'location';
    for location in select day_location union all select value->'location' from jsonb_array_elements(day->'items') where value->'location' <> 'null'::jsonb loop
      if coalesce(location->>'type','') not in ('in_person','online','hybrid') then raise exception 'Choose a day or item location type.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
      if location->>'type'<>'online' and (coalesce(btrim(location->>'building'),'')='' or coalesce(btrim(location->>'address'),'')='') then raise exception 'In-person locations require a building and street address.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
      if location->>'type'<>'in_person' and coalesce(btrim(location->>'meeting_url'),'')='' then raise exception 'Online locations require a meeting link.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
      if config->>'audience'='going' and coalesce(btrim(location->>'public_summary'),'')='' then raise exception 'Add a public location summary for each restricted location.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
      if (location->>'type'<>'online' and coalesce(location->>'map_url','')<>'' and (location->>'map_url') !~* '^https?://[^/[:space:]]+') or (location->>'type'<>'in_person' and coalesce(location->>'meeting_url','')<>'' and (location->>'meeting_url') !~* '^https?://[^/[:space:]]+') then raise exception 'Enter valid HTTP or HTTPS location links.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
    end loop;
    for item in select value from jsonb_array_elements(day->'items') loop
      key:=(item->>'key')::uuid;
      if key is null or key=any(all_keys) or coalesce(btrim(item->>'label'),'')='' or jsonb_typeof(item->'check_in') is distinct from 'boolean' then raise exception 'Every agenda item needs its own identity, label and check-in setting.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
      all_keys:=array_append(all_keys,key); item_ids:=array_append(item_ids,key);
      if exists(select 1 from public.event_agenda_items i join public.event_agenda_days d on d.id=i.event_agenda_day_id where i.id=key and (d.event_id is distinct from p_event_id or d.id<>(day->>'key')::uuid)) then raise exception 'Agenda item belongs to another day or event.'; end if;
      item_start:=public.agenda_pacific_instant(day->>'date',item->>'start');
      item_end:=public.agenda_pacific_instant(item->>'end_date',item->>'end');
      if item_end<=item_start then raise exception 'Item end must be after its start.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
      day_start:=least(day_start,item_start); day_end:=greatest(day_end,item_end);
      item:=item||jsonb_build_object('start_time',item_start,'end_time',item_end);
      if (item->>'check_in')::boolean then
        sessions:=sessions||jsonb_build_array(jsonb_build_object('id',item->'session_id','name',item->>'label','start_time',item_start,'end_time',item_end));
      end if;
      items:=items||jsonb_build_array(item);
    end loop;
    first_start:=least(first_start,day_start); last_end:=greatest(last_end,day_end);
    days:=days||jsonb_build_array(day||jsonb_build_object('items',items,'start_time',day_start,'end_time',day_end));
  end loop;
  config:=config||jsonb_build_object('dates',days,'location',days->0->'location');
  location:=config->'location';
  p_event:=p_event||jsonb_build_object('starts_at',first_start,'ends_at',last_end,
    'location_type',location->>'type',
    'location_building',case when config->>'audience'='going' then location->>'public_summary' when location->>'type'='online' then 'Online' else location->>'building' end,
    'location_room',case when config->>'audience'='everyone' and location->>'type'<>'online' then nullif(location->>'room','') end,
    'location_address',case when config->>'audience'='everyone' and location->>'type'<>'online' then nullif(location->>'address','') end,
    'location_address_url',case when config->>'audience'='everyone' and location->>'type'<>'online' then nullif(location->>'map_url','') end);
  if p_event_id is not null then
    insert into public.event_date_location_settings values(p_event_id,config,coalesce(existing.revision,0)+1)
    on conflict(event_id) do update set document=excluded.document,revision=excluded.revision;
  end if;
  result:=public.save_admin_event_before_date_locations(p_event_id,p_event,p_slug,p_expected_image_url,sessions,p_application_questions,p_mentors,p_sponsors);
  eid:=(result->>'id')::uuid; days:='[]';
  for day in select value from jsonb_array_elements(config->'dates') loop
    insert into public.event_agenda_days(id,event_id,date,title,starts_at,ends_at)
    values((day->>'key')::uuid,eid,(day->>'date')::date,day->>'label',(day->>'start_time')::timestamptz,(day->>'end_time')::timestamptz)
    on conflict(id) do update set date=excluded.date,title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at;
    items:='[]';
    for item in select value from jsonb_array_elements(day->'items') loop
      location:=case when item->'location' is null or item->'location'='null'::jsonb then day->'location' else item->'location' end;
      insert into public.event_agenda_items(id,event_agenda_day_id,title,start_time,end_time,starts_at,ends_at,description,check_in,building,room)
      values((item->>'key')::uuid,(day->>'key')::uuid,item->>'label',(item->>'start')::time,(item->>'end')::time,(item->>'start_time')::timestamptz,(item->>'end_time')::timestamptz,coalesce(item->>'description',''),(item->>'check_in')::boolean,
        case when config->>'audience'='going' then location->>'public_summary' when location->>'type'='online' then 'Online' else location->>'building' end,
        case when config->>'audience'='everyone' and location->>'type'<>'online' then nullif(location->>'room','') end)
      on conflict(id) do update set title=excluded.title,start_time=excluded.start_time,end_time=excluded.end_time,starts_at=excluded.starts_at,ends_at=excluded.ends_at,description=excluded.description,check_in=excluded.check_in,building=excluded.building,room=excluded.room;
      sid:=null;
      if (item->>'check_in')::boolean then
        sid:=(result->'check_in_session_ids'->>idx)::uuid; idx:=idx+1;
        update public.check_in_sessions set agenda_item_id=(item->>'key')::uuid where id=sid;
      end if;
      items:=items||jsonb_build_array(item||jsonb_build_object('session_id',sid));
    end loop;
    days:=days||jsonb_build_array(day||jsonb_build_object('items',items));
  end loop;
  delete from public.event_agenda_items i using public.event_agenda_days d where i.event_agenda_day_id=d.id and d.event_id=eid and not(i.id=any(item_ids));
  delete from public.event_agenda_days where event_id=eid and not(id=any(day_ids));
  config:=jsonb_set(config,'{dates}',days);
  insert into public.event_date_location_settings values(eid,config,coalesce(existing.revision,0)+1)
  on conflict(event_id) do update set document=excluded.document,revision=excluded.revision;
  location:=config->'location';
  if location->>'type'<>'in_person' then
    insert into public.event_private_details(event_id,meeting_url,meeting_id,meeting_passcode)
    values(eid,location->>'meeting_url',nullif(location->>'meeting_id',''),nullif(location->>'meeting_passcode',''))
    on conflict(event_id) do update set meeting_url=excluded.meeting_url,meeting_id=excluded.meeting_id,meeting_passcode=excluded.meeting_passcode;
  else delete from public.event_private_details where event_id=eid;
  end if;
  return result||jsonb_build_object('date_location_revision',coalesce(existing.revision,0)+1);
end $$;
revoke all on function public.save_admin_event_before_agenda(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.save_admin_event_before_application_settings(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_admin_event_before_application_settings(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.update_admin_event_schedule(p_event_id uuid, p_patch jsonb)
 RETURNS SETOF events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events; document jsonb; field text; saved_row public.events; op uuid:=(p_patch->>'_operation_id')::uuid; receipt public.admin_event_mutations; req jsonb;
begin
 if auth.role() is distinct from 'service_role' and not coalesce(public.is_admin(),false) then raise exception 'Staff access required.' using errcode='42501'; end if;
     perform pg_catalog.pg_advisory_xact_lock(20270101,13);
     req:=jsonb_build_object('kind','schedule','event_id',p_event_id,'patch',p_patch);
     if op is not null then
       select * into receipt from public.admin_event_mutations where id=op;
       if found then
         if receipt.request<>req then raise exception 'This retry differs from the original request.' using hint='EVENT_REVISION_CONFLICT'; end if;
         return query select * from jsonb_populate_record(null::public.events,receipt.result);
         return;
       end if;
     end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then return; end if;
 if p_patch ? '_expected_revision' and e.revision<>(p_patch->>'_expected_revision')::integer then
   raise exception 'This event changed in another tab. Reload before saving.' using hint='EVENT_REVISION_CONFLICT';
 end if;
 if public.event_has_ended(e) then raise exception 'This event has ended. Only links and resources can be updated.' using hint='EVENT_HISTORY_LOCKED'; end if;
 document:=e.working_document;
 if document #>> '{formState,date_location,version}'='2' and (e.starts_at,e.ends_at) is distinct from ((p_patch->>'starts_at')::timestamptz,(p_patch->>'ends_at')::timestamptz) then raise exception 'Edit agenda item timing in the event builder.' using hint='EVENT_SETTINGS_CONFLICT'; end if;
    if jsonb_array_length(document #> '{formState,date_location,dates}') > 1 and
       (e.starts_at,e.ends_at) is distinct from ((p_patch->>'starts_at')::timestamptz,(p_patch->>'ends_at')::timestamptz) then
      raise exception 'Edit individual event dates in the event form.' using hint='EVENT_SETTINGS_CONFLICT';
    end if;
    if document #>> '{formState,date_location,version}' is distinct from '2' and jsonb_array_length(document #> '{formState,date_location,dates}') = 1 then
      document:=jsonb_set(document,'{formState,date_location,dates,0,date}',to_jsonb(coalesce(to_char(public.draft_event_wall_time((p_patch->>'starts_at')::timestamptz),'YYYY-MM-DD'),'')));
      document:=jsonb_set(document,'{formState,date_location,dates,0,start}',to_jsonb(coalesce(to_char(public.draft_event_wall_time((p_patch->>'starts_at')::timestamptz),'HH24:MI'),'')));
      document:=jsonb_set(document,'{formState,date_location,dates,0,end}',to_jsonb(coalesce(to_char(public.draft_event_wall_time((p_patch->>'ends_at')::timestamptz),'HH24:MI'),'')));
    end if;
 if document is not null then
   foreach field in array array['starts_at','ends_at','registration_opens_at','registration_closes_at'] loop
     document:=jsonb_set(document,array['formState',field],to_jsonb(coalesce(to_char(public.draft_event_wall_time((p_patch->>field)::timestamptz),'YYYY-MM-DD"T"HH24:MI'),'')));
   end loop;
 end if;
 return query update public.events set status=(p_patch->>'status')::public.event_status,
  working_document=document,working_revision=working_revision+case when document is not null then 1 else 0 end,
  publish_at=(p_patch->>'publish_at')::timestamptz,starts_at=(p_patch->>'starts_at')::timestamptz,ends_at=(p_patch->>'ends_at')::timestamptz,
  registration_opens_at=(p_patch->>'registration_opens_at')::timestamptz,registration_closes_at=(p_patch->>'registration_closes_at')::timestamptz
 where id=p_event_id returning *;
    update public.admin_event_drafts d set document=saved.working_document,revision=saved.working_revision,event_revision=saved.revision,updated_at=now()
    from public.events saved where saved.id=p_event_id and d.event_id=saved.id and not d.materialized and saved.working_document is not null;
    if op is not null then
      select * into saved_row from public.events where id=p_event_id;
      insert into public.admin_event_mutations(id,request,result) values(op,req,to_jsonb(saved_row));
    end if;
end $function$

;

-- Invalid/unfinished draft times remain text and project to null.
create function public.agenda_draft_instant(p_date text,p_time text) returns timestamptz
language plpgsql immutable set search_path='' as $$
begin return public.agenda_pacific_instant(p_date,p_time);
exception when others then return null;
end $$;
revoke all on function public.agenda_draft_instant(text,text) from public,anon,authenticated;
create function public.project_agenda_working_document() returns trigger
language plpgsql security definer set search_path='' as $$
declare s jsonb; first_start timestamptz; last_end timestamptz;
begin
  if new.working_document #>> '{formState,date_location,version}'='2' then
    perform 1 from public.check_in_sessions where event_id=new.id for update;
    if exists(select 1 from public.check_in_sessions session join public.check_ins c on c.check_in_session_id=session.id
      where session.event_id=new.id and session.agenda_item_id is not null and not exists(
        select 1 from jsonb_array_elements(new.working_document #> '{formState,date_location,dates}') d
        cross join lateral jsonb_array_elements(d->'items') i
        where (i->>'key')::uuid=session.agenda_item_id and i->>'check_in'='true')) then
      raise exception 'An attended item cannot be removed or have check-in disabled.' using hint='CHECK_IN_SESSIONS_CONFLICT';
    end if;
    select min(public.agenda_draft_instant(d->>'date',i->>'start')),
      max(public.agenda_draft_instant(i->>'end_date',i->>'end')) into first_start,last_end
    from jsonb_array_elements(new.working_document #> '{formState,date_location,dates}') d
    cross join lateral jsonb_array_elements(d->'items') i;
    new.starts_at:=first_start; new.ends_at:=last_end;
    s:=new.working_document->'formState';
    s:=s||jsonb_build_object('starts_at',coalesce(to_char(public.draft_event_wall_time(first_start),'YYYY-MM-DD"T"HH24:MI'),''),
      'ends_at',coalesce(to_char(public.draft_event_wall_time(last_end),'YYYY-MM-DD"T"HH24:MI'),''));
    new.working_document:=jsonb_set(new.working_document,'{formState}',s);
  end if;
  return new;
end $$;
revoke all on function public.project_agenda_working_document() from public,anon,authenticated;
create trigger aaa_project_agenda_working_document before insert or update on public.events
for each row execute function public.project_agenda_working_document();

create function public.guard_agenda_check_in_target() returns trigger
language plpgsql security definer set search_path='' as $$
declare session public.check_in_sessions; item public.event_agenda_items;
begin
  select * into session from public.check_in_sessions where id=new.check_in_session_id for key share;
  if session.agenda_item_id is not null then
    select * into item from public.event_agenda_items where id=session.agenda_item_id for key share;
    if not item.check_in then raise exception 'This item does not accept check-in.' using hint='CHECK_IN_SESSIONS_CONFLICT'; end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_agenda_check_in_target() from public,anon,authenticated;
create trigger guard_agenda_check_in_target before insert or update of check_in_session_id on public.check_ins
for each row execute function public.guard_agenda_check_in_target();
