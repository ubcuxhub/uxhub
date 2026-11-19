-- Private resource storage: never extend the participant resource audience enum.
create function public.safe_staff_schedule_url(p_url text) returns boolean
language plpgsql immutable set search_path='' as $$
declare authority text; host text; port text; parts text[];
begin
 if p_url is null or length(p_url)>5000 or p_url !~* '^https://' or p_url ~ '[[:space:]\\]' then return false; end if;
 authority := substring(p_url from '(?i)^https://([^/?#]+)');
 parts := regexp_match(authority,'(?i)^(\[[a-f0-9:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?$');
 if parts is null then return false; end if;
 host := parts[1]; port := parts[2];
 if port is not null and port::integer>65535 then return false; end if;
 if host like '[%' then perform trim(both '[]' from host)::inet;
 elsif host ~ '^[0-9.]+$' then perform host::inet;
 end if;
 return true;
exception when invalid_text_representation then return false;
end $$;

create table public.event_staff_volunteer_schedules (
 event_id uuid primary key references public.events(id) on delete cascade,
 id uuid not null unique default gen_random_uuid(),
 label text not null default 'Volunteer Schedule' check(length(label)<=5000),
 url text not null check (public.safe_staff_schedule_url(url)),
 sort_order integer not null default 0 check(sort_order>=0)
);
alter table public.event_staff_volunteer_schedules enable row level security;
revoke all on public.event_staff_volunteer_schedules from anon,authenticated;
grant select on public.event_staff_volunteer_schedules to authenticated;
grant all on public.event_staff_volunteer_schedules to service_role;
create policy "staff read volunteer schedules" on public.event_staff_volunteer_schedules
 for select to authenticated using (public.is_admin());

create function public.validate_staff_schedule_content(p_document jsonb,p_draft boolean default false) returns void
language plpgsql immutable set search_path='' as $$
declare link jsonb;
begin
 if p_document ? 'resources_version' and p_document->'resources_version' <> '2'::jsonb then
  raise exception 'Invalid resource version.' using hint='EVENT_CONTENT_INVALID';
 end if;
 if (select count(*) from jsonb_array_elements(p_document->'links') l where l->>'type'='volunteer_schedule')>1 then
  raise exception 'Only one Volunteer Schedule is allowed per event.' using hint='EVENT_CONTENT_INVALID';
 end if;
 for link in select value from jsonb_array_elements(p_document->'links') where value->>'type'='volunteer_schedule' loop
  if link->>'visibility' is distinct from 'staff' or jsonb_typeof(link->'url') is distinct from 'string'
    or jsonb_typeof(link->'label') is distinct from 'string' or length(link->>'label')>5000
    or (link->>'id') is null then
   raise exception 'Volunteer Schedule is visible only to staff.' using hint='EVENT_CONTENT_INVALID';
  end if;
  perform (link->>'id')::uuid;
  if (not p_draft or link->>'url'<>'') and not public.safe_staff_schedule_url(link->>'url') then
   raise exception 'Use an absolute HTTPS URL without a username or password.' using hint='EVENT_CONTENT_INVALID';
  end if;
 end loop;
end $$;

-- Resource version 2 distinguishes removal from an old caller omitting the
-- protected row. Incomplete working drafts never erase a saved valid schedule.
create function public.sync_staff_schedule(p_event_id uuid,p_document jsonb,p_draft boolean) returns void
language plpgsql set search_path='' as $$
declare link jsonb; position integer;
begin
 perform public.validate_staff_schedule_content(p_document,p_draft);
 select value,ordinality-1 into link,position from jsonb_array_elements(p_document->'links') with ordinality where value->>'type'='volunteer_schedule';
 if link is not null then
  if link->>'url'<>'' then
   insert into public.event_staff_volunteer_schedules(event_id,id,label,url,sort_order)
    values(p_event_id,(link->>'id')::uuid,link->>'label',link->>'url',position)
    on conflict(event_id) do update set id=excluded.id,label=excluded.label,url=excluded.url,sort_order=excluded.sort_order;
  end if;
 elsif p_document->'resources_version'='2'::jsonb then
  delete from public.event_staff_volunteer_schedules where event_id=p_event_id;
 end if;
end $$;

create function public.sync_staff_schedule_draft() returns trigger
language plpgsql set search_path='' as $$
begin
 perform public.sync_staff_schedule(new.id,new.working_document->'formState'->'content',true);
 return new;
end $$;
create trigger sync_staff_schedule_draft after insert or update of working_document
 on public.events for each row execute function public.sync_staff_schedule_draft();

create function public.sync_staff_schedule_content() returns trigger
language plpgsql set search_path='' as $$
begin
 perform public.sync_staff_schedule(new.event_id,new.document,false);
 return new;
end $$;
create trigger sync_staff_schedule_content after insert or update of document
 on public.event_content_settings for each row execute function public.sync_staff_schedule_content();
revoke all on function public.validate_staff_schedule_content(jsonb,boolean),public.sync_staff_schedule(uuid,jsonb,boolean),public.sync_staff_schedule_draft(),public.sync_staff_schedule_content() from public,anon,authenticated;
grant execute on function public.validate_staff_schedule_content(jsonb,boolean),public.sync_staff_schedule(uuid,jsonb,boolean),public.sync_staff_schedule_draft(),public.sync_staff_schedule_content() to service_role;

CREATE OR REPLACE FUNCTION public.validate_event_content(p_document jsonb, p_draft boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s jsonb; i jsonb; l jsonb; titles text[] := '{}'; groups text[] := '{}'; t text;
begin
 if jsonb_typeof(p_document) <> 'object' or jsonb_typeof(p_document->'sections') <> 'array' or jsonb_typeof(p_document->'links') <> 'array'
 or jsonb_array_length(p_document->'sections') > 100 or jsonb_array_length(p_document->'links') > 100 then
   raise exception 'Invalid people and resource content.' using hint = 'EVENT_CONTENT_INVALID';
 end if;
 perform public.validate_staff_schedule_content(p_document,p_draft);
 for s in select value from jsonb_array_elements(p_document->'sections') loop
   perform (s->>'key')::uuid;
   t := lower(btrim(s->>'title'));
   if (not p_draft and (coalesce(t, '') = '' or t = any(titles))) or length(t) > 120 or jsonb_typeof(s->'items') <> 'array' then
     raise exception 'Section names must be nonblank and unique.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   titles := array_append(titles, t);
   if s->>'kind' not in ('Judges','Mentors','Speakers','Panelists','Sponsors','custom') or s->>'kind' is null then
     raise exception 'Invalid section group.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   if not p_draft and s->>'kind' <> 'custom' then
     if s->>'title' <> s->>'kind' or s->>'kind' = any(groups) then raise exception 'Each predefined group can only be added once with its fixed name.' using hint = 'EVENT_CONTENT_INVALID'; end if;
     groups := array_append(groups, s->>'kind');
   elsif not p_draft and t in ('judges','mentors','speakers','panelists','sponsors') then
     raise exception 'Custom sections cannot use a predefined group name.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   if not p_draft and jsonb_array_length(s->'items') = 0 then raise exception 'Add at least one item or remove this section.' using hint = 'EVENT_CONTENT_INVALID'; end if;
   if jsonb_array_length(s->'items') > 200 then raise exception 'Too many section entries.' using hint = 'EVENT_CONTENT_INVALID'; end if;
   if (select count(*) <> count(distinct value->>'key') from jsonb_array_elements(s->'items'))
     or (select count(value->>'directory_id') <> count(distinct value->>'directory_id') from jsonb_array_elements(s->'items')) then
     raise exception 'An entry can only be added once per section.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   for i in select value from jsonb_array_elements(s->'items') loop
     perform (i->>'key')::uuid;
     if not p_draft and coalesce(btrim(i->>'name'), '') = '' then raise exception 'Every entry needs a name.' using hint = 'EVENT_CONTENT_INVALID'; end if;
     if coalesce(i->>'url', '') <> '' and not public.safe_event_content_url(i->>'url') then raise exception 'Entry links must use a safe HTTP or HTTPS URL.' using hint = 'EVENT_CONTENT_INVALID'; end if;
     if coalesce(i->>'image_url', '') <> '' and not public.safe_event_content_url(i->>'image_url') and (i->>'image_url') !~ '^/[^/]' then raise exception 'Invalid entry image URL.' using hint = 'EVENT_CONTENT_INVALID'; end if;
   end loop;
 end loop;
 if (select count(*) <> count(distinct value->>'key') from jsonb_array_elements(p_document->'sections')) then raise exception 'Duplicate section identity.' using hint = 'EVENT_CONTENT_INVALID'; end if;
 if (select count(*) <> count(distinct item->>'key') from jsonb_array_elements(p_document->'sections') section, jsonb_array_elements(section->'items') item) then raise exception 'Duplicate entry identity.' using hint = 'EVENT_CONTENT_INVALID'; end if;
 if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(p_document->'links')) then raise exception 'Duplicate resource identity.' using hint = 'EVENT_CONTENT_INVALID'; end if;
 for l in select value from jsonb_array_elements(p_document->'links') loop
   perform (l->>'id')::uuid;
   if l->>'type'='volunteer_schedule' then continue; end if;
   if (l->>'type') not in ('slack_workspace','participant_package','event_recap','other') or l->>'type' is null
    or (l->>'visibility') not in ('everyone','going','after_event') or l->>'visibility' is null then
     raise exception 'Invalid resource type or audience.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   if (not p_draft or coalesce(l->>'url','') <> '') and not coalesce(public.safe_event_content_url(l->>'url'), false) then raise exception 'Resource links must use a safe HTTP or HTTPS URL.' using hint = 'EVENT_CONTENT_INVALID'; end if;
   if not p_draft and l->>'type' = 'other' and coalesce(btrim(l->>'label'),'') = '' then raise exception 'Other links need a label.' using hint = 'EVENT_CONTENT_INVALID'; end if;
 end loop;
end;
$function$

;


-- Once copied, an entry remains event-owned even if reverted to source values.
-- The original migration is already applied locally; retain its history.
create or replace function public.save_admin_event_atomically(
 p_event_id uuid, p_event jsonb, p_slug text, p_expected_image_url text,
 p_check_in_sessions jsonb, p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
 d jsonb := p_event->'_content'; r jsonb; eid uuid; sec jsonb; item jsonb; link jsonb;
 sid uuid; mid uuid; pos integer; section_pos integer := 0; existing_revision integer;
 m public.mentors; sp public.sponsors; selected_mentors jsonb; selected_sponsors jsonb;
begin
 if d is null then
   return public.save_admin_event_before_content(p_event_id,p_event,p_slug,p_expected_image_url,p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
 end if;
 perform public.validate_event_content(d);
 if p_event_id is not null then
   perform 1 from public.events where id = p_event_id for update;
   select revision into existing_revision from public.event_content_settings where event_id = p_event_id;
   if coalesce(existing_revision,0) <> coalesce((d->>'revision')::integer,0) then raise exception 'People or resources changed in another tab. Reload before saving.' using hint = 'EVENT_CONTENT_INVALID'; end if;
 end if;
 -- The legacy save must retain the associations until the complete editor syncs them.
 select coalesce(jsonb_agg(mentor_id order by sort_order),'[]') into selected_mentors
 from public.event_mentors where event_id = p_event_id and section_id in (select id from public.event_people_sections where event_id = p_event_id and lower(btrim(title)) = 'mentors');
 select coalesce(jsonb_agg(sponsor_id order by sort_order),'[]') into selected_sponsors from public.event_sponsors where event_id = p_event_id;
 p_event := p_event || jsonb_build_object('mentors_enabled', exists(select 1 from jsonb_array_elements(d->'sections') s where s->>'kind' <> 'Sponsors'), 'sponsors_enabled', exists(select 1 from jsonb_array_elements(d->'sections') s where s->>'kind' = 'Sponsors'));
 r := public.save_admin_event_before_content(p_event_id,p_event - '_content',p_slug,p_expected_image_url,p_check_in_sessions,p_application_questions,selected_mentors,selected_sponsors);
 eid := (r->>'id')::uuid;
 -- All changes below participate in the parent transaction; shared rows are never updated.
 delete from public.event_mentors where event_id = eid;
 delete from public.event_sponsors where event_id = eid;
 -- Retain section identities; park titles to allow renaming/swapping custom names.
 update public.event_people_sections set title = '__content_' || id::text where event_id = eid;
 for sec in select value from jsonb_array_elements(d->'sections') loop
   sid := (sec->>'key')::uuid;
   if exists(select 1 from public.event_people_sections where id = sid and event_id <> eid) then raise exception 'Section belongs to another event.' using hint = 'EVENT_CONTENT_INVALID'; end if;
   insert into public.event_people_sections(id,event_id,title,sort_order) values(sid,eid,sec->>'title',section_pos)
   on conflict(id) do update set title=excluded.title,sort_order=excluded.sort_order;
   pos := 0;
   for item in select value from jsonb_array_elements(sec->'items') loop
     mid := null;
     if sec->>'kind' = 'Sponsors' then
       if item->>'directory_id' is not null and not exists(select 1 from public.sponsors where id=(item->>'key')::uuid and owner_event_id=eid) then
         select * into sp from public.sponsors where id = (item->>'directory_id')::uuid and owner_event_id is null;
         if not found then raise exception 'The selected shared sponsor was not found.' using hint = 'EVENT_CONTENT_INVALID'; end if;
         if (sp.name,coalesce(sp.description,''),coalesce(sp.website_url,''),coalesce(sp.brand_logo_path,'')) is not distinct from
            (item->>'name',item->>'description',item->>'url',item->>'image_url') then mid := sp.id; end if;
       end if;
       if mid is null then
         mid := (item->>'key')::uuid;
         if exists(select 1 from public.sponsors where id = mid and owner_event_id is distinct from eid) then raise exception 'Entry belongs to another event.' using hint = 'EVENT_CONTENT_INVALID'; end if;
         insert into public.sponsors(id,owner_event_id,name,description,website_url,brand_logo_path)
         values(mid,eid,btrim(item->>'name'),nullif(item->>'description',''),nullif(item->>'url',''),nullif(item->>'image_url',''))
         on conflict(id) do update set name=excluded.name,description=excluded.description,website_url=excluded.website_url,brand_logo_path=excluded.brand_logo_path;
       end if;
       insert into public.event_sponsors(event_id,sponsor_id,sort_order) values(eid,mid,pos);
     else
       if item->>'directory_id' is not null and not exists(select 1 from public.mentors where id=(item->>'key')::uuid and owner_event_id=eid) then
         select * into m from public.mentors where id = (item->>'directory_id')::uuid and owner_event_id is null;
         if not found then raise exception 'The selected shared person was not found.' using hint = 'EVENT_CONTENT_INVALID'; end if;
         if (m.full_name,coalesce(m.position,''),coalesce(m.description,''),coalesce(m.linkedin_url,''),coalesce(m.profile_image_path,'')) is not distinct from
           (item->>'name',item->>'position',item->>'description',item->>'url',item->>'image_url') then mid := m.id; end if;
       end if;
       if mid is null then
         mid := (item->>'key')::uuid;
         if exists(select 1 from public.mentors where id = mid and owner_event_id is distinct from eid) then raise exception 'Entry belongs to another event.' using hint = 'EVENT_CONTENT_INVALID'; end if;
         insert into public.mentors(id,owner_event_id,full_name,position,description,linkedin_url,profile_image_path)
         values(mid,eid,btrim(item->>'name'),nullif(item->>'position',''),nullif(item->>'description',''),nullif(item->>'url',''),nullif(item->>'image_url',''))
         on conflict(id) do update set full_name=excluded.full_name,position=excluded.position,description=excluded.description,linkedin_url=excluded.linkedin_url,profile_image_path=excluded.profile_image_path;
       end if;
       insert into public.event_mentors(event_id,section_id,mentor_id,sort_order) values(eid,sid,mid,pos);
     end if;
     pos := pos + 1;
   end loop;
   section_pos := section_pos + 1;
 end loop;
 delete from public.event_people_sections where event_id=eid and id not in (select (value->>'key')::uuid from jsonb_array_elements(d->'sections'));
 for link in select value from jsonb_array_elements(d->'links') loop
   if exists(select 1 from public.event_links where id=(link->>'id')::uuid and event_id<>eid) then raise exception 'Resource belongs to another event.' using hint = 'EVENT_CONTENT_INVALID'; end if;
 end loop;
 delete from public.event_links where event_id=eid;
 insert into public.event_links(id,event_id,type,label,url,visibility,sort_order)
 select (value->>'id')::uuid,eid,(value->>'type')::public.event_link_type,nullif(btrim(value->>'label'),''),value->>'url',(value->>'visibility')::public.event_link_visibility,ordinality-1
 from jsonb_array_elements(d->'links') with ordinality where value->>'type'<>'volunteer_schedule';
 d := d || jsonb_build_object('revision',coalesce(existing_revision,0)+1);
 insert into public.event_content_settings(event_id,document,revision) values(eid,d,coalesce(existing_revision,0)+1)
 on conflict(event_id) do update set document=excluded.document,revision=excluded.revision;
 return r || jsonb_build_object('content', d);
end;
$$;

-- Optional argument preserves older RPC clients and retry payloads.
drop function public.save_past_event_resources(uuid,integer,jsonb,uuid);
create function public.save_past_event_resources(p_event_id uuid,p_revision integer,p_links jsonb,p_operation_id uuid,p_resources_version integer default null)
returns jsonb language plpgsql set search_path = '' as $$
declare e public.events; d jsonb; rev integer; r jsonb; req jsonb; receipt public.admin_event_mutations; content jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 req := jsonb_build_object('event_id',p_event_id,'revision',p_revision,'links',p_links,'kind','resources');
 if p_resources_version is not null then req:=req||jsonb_build_object('resources_version',p_resources_version); end if;
 select * into receipt from public.admin_event_mutations where id=p_operation_id;
 if found then
  if receipt.request <> req then raise exception 'This retry differs from the original request.' using hint='EVENT_REVISION_CONFLICT'; end if;
  return receipt.result;
 end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'This event no longer exists.' using hint='EVENT_REVISION_CONFLICT'; end if;
 if e.revision <> p_revision then raise exception 'This event changed in another tab. Reload before saving; your edits are still here.' using hint='EVENT_REVISION_CONFLICT'; end if;
 if not public.event_has_ended(e) then raise exception 'This event has not ended. Reload before saving.' using hint='EVENT_HISTORY_LOCKED'; end if;
 -- Validate only the editable resources. Legacy people need not be rewritten.
 content:=jsonb_build_object('revision',0,'sections','[]'::jsonb,'links',p_links);
 if p_resources_version is not null then content:=content||jsonb_build_object('resources_version',p_resources_version); end if;
 perform public.validate_event_content(content);
 perform public.sync_staff_schedule(p_event_id,content,false);
 if exists(select 1 from jsonb_array_elements(p_links) l join public.event_links el on el.id=(l->>'id')::uuid where el.event_id<>p_event_id) then
  raise exception 'Resource belongs to another event.' using hint='EVENT_CONTENT_INVALID';
 end if;
 select document,revision into d,rev from public.event_content_settings where event_id=p_event_id;
 -- No content-settings row is needed for legacy people: the read helper still
 -- reconstructs those sections while reading the canonical resource rows.
 delete from public.event_links where event_id=p_event_id;
 insert into public.event_links(id,event_id,type,label,url,visibility,sort_order)
 select (value->>'id')::uuid,p_event_id,(value->>'type')::public.event_link_type,nullif(btrim(value->>'label'),''),value->>'url',(value->>'visibility')::public.event_link_visibility,ordinality-1
 from jsonb_array_elements(p_links) with ordinality where value->>'type'<>'volunteer_schedule';
 if d is not null then
  d := (d-'resources_version') || jsonb_build_object('links',p_links,'revision',rev+1);
  if p_resources_version is not null then d:=d||jsonb_build_object('resources_version',p_resources_version); end if;
  update public.event_content_settings set document=d,revision=rev+1 where event_id=p_event_id;
 end if;
 update public.events set revision=revision+1 where id=p_event_id returning * into e;
 r := jsonb_build_object('id',e.id,'revision',e.revision,'content',d);
 insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r);
 return r;
end $$;
revoke all on function public.save_past_event_resources(uuid,integer,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.save_past_event_resources(uuid,integer,jsonb,uuid,integer) to service_role;
