-- Agenda item links (Figma "Agenda", 4640:844): an agenda item's title can link
-- to a resource, such as a slides template. The link is an ordinary event_links
-- row that names its agenda item, so it keeps the link's own visibility (RLS)
-- and still shows wherever its type normally shows.
--
-- The column is nullable and every existing writer leaves it out, so the code
-- already deployed is unaffected. The builder doesn't send it either: the two
-- resource saves below carry each link's agenda item over by link id.

alter table public.event_links
  -- At most one link per item, and it goes when its item is deleted.
  add column agenda_item_id uuid unique
    references public.event_agenda_items(id) on delete cascade;

-- event_agenda_items carries no event_id, so a foreign key can't keep the link
-- and its item on the same event; this trigger does.
create function public.event_links_agenda_item_same_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.agenda_item_id is not null and not exists (
    select 1
    from public.event_agenda_items item
    join public.event_agenda_days day on day.id = item.event_agenda_day_id
    where item.id = new.agenda_item_id
      and day.event_id = new.event_id
  ) then
    raise exception 'An agenda item link must belong to the same event as its item.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger event_links_agenda_item_same_event
  before insert or update of agenda_item_id, event_id on public.event_links
  for each row execute function public.event_links_agenda_item_same_event();

-- ── event_participant_content ────────────────────────────────────────────
--
-- Unchanged from 20261118012144 except that each day now says whether it set
-- its own location (`location_overridden`), as items already do, so a day
-- heading can name a venue only when it differs from the event's.

create or replace function public.event_participant_content(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events; config jsonb; day jsonb; item jsonb; loc jsonb;
  restricted boolean; days jsonb := '[]'; items jsonb; summary jsonb;
  staff boolean := public.is_admin(); d public.event_agenda_days; i public.event_agenda_items;
begin
  select * into e from public.events where id=p_event_id;
  if not found or not (staff or public.event_is_public(e.status,e.publish_at)) then
    return jsonb_build_object('location',null,'agenda','[]'::jsonb);
  end if;
  select document into config from public.event_date_location_settings where event_id=e.id;
  restricted := coalesce(config->>'audience','going') <> 'everyone' and not staff
    and not exists(select 1 from public.event_tickets t
      where t.event_id=e.id and t.user_id=public.current_user_info_id());
  -- The earliest dated day is the summary location, independent of display switch.
  select value into day from jsonb_array_elements(coalesce(config->'dates','[]'))
    order by value->>'date', value->>'key' limit 1;
  summary := public.participant_agenda_location(coalesce(nullif(day->'location','null'),config->'location'),restricted);
  if e.agenda_enabled then
    for d in select * from public.event_agenda_days where event_id=e.id order by date,id loop
      select value into day from jsonb_array_elements(coalesce(config->'dates','[]')) where value->>'key'=d.id::text;
      items := '[]';
      for i in select * from public.event_agenda_items where event_agenda_day_id=d.id order by starts_at,id loop
        select value into item from jsonb_array_elements(coalesce(day->'items','[]')) where value->>'key'=i.id::text;
        loc := coalesce(nullif(item->'location','null'),nullif(day->'location','null'),config->'location');
        items := items || jsonb_build_array(jsonb_build_object(
          'id',i.id,'title',i.title,'starts_at',i.starts_at,'ends_at',i.ends_at,
          'description',i.description,'check_in',i.check_in,
          'location_overridden',coalesce(item->'location','null'::jsonb)<>'null'::jsonb,
          'location',public.participant_agenda_location(loc,restricted)));
      end loop;
      days := days || jsonb_build_array(jsonb_build_object(
        'id',d.id,'date',d.date,'title',d.title,'items',items,
        'location_overridden',coalesce(day->'location','null'::jsonb)<>'null'::jsonb,
        'location',public.participant_agenda_location(coalesce(nullif(day->'location','null'),config->'location'),restricted)));
    end loop;
  end if;
  return jsonb_build_object('location',summary,'agenda',days);
end;
$$;
revoke all on function public.event_participant_content(uuid) from public;
grant execute on function public.event_participant_content(uuid) to anon,authenticated,service_role;

-- ── Resource saves keep agenda item links ────────────────────────────────
--
-- Both delete every event_links row of the event and re-insert the builder's
-- links under the same ids, which would otherwise drop agenda_item_id on any
-- routine save. Unchanged from 20261118012146 (save_admin_event_atomically)
-- and 20261118012150 (save_past_event_resources) except that they read each
-- link's agenda item before the delete and write it back. A link the save
-- drops loses its item with it; an item the save deleted already took its
-- link (on delete cascade), so every carried id still exists.

create or replace function public.save_admin_event_atomically(
 p_event_id uuid, p_event jsonb, p_slug text, p_expected_image_url text,
 p_check_in_sessions jsonb, p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
 d jsonb := p_event->'_content'; r jsonb; eid uuid; sec jsonb; item jsonb; link jsonb;
 sid uuid; mid uuid; pos integer; section_pos integer := 0; existing_revision integer;
 m public.mentors; sp public.sponsors; selected_mentors jsonb; selected_sponsors jsonb; item_links jsonb;
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
 -- Links re-insert under their own ids; carry each one's agenda item over.
 select coalesce(jsonb_object_agg(id,agenda_item_id),'{}') into item_links from public.event_links where event_id=eid and agenda_item_id is not null;
 delete from public.event_links where event_id=eid;
 insert into public.event_links(id,event_id,type,label,url,visibility,sort_order,agenda_item_id)
 select (value->>'id')::uuid,eid,(value->>'type')::public.event_link_type,nullif(btrim(value->>'label'),''),value->>'url',(value->>'visibility')::public.event_link_visibility,ordinality-1,(item_links->>(value->>'id'))::uuid
 from jsonb_array_elements(d->'links') with ordinality where value->>'type'<>'volunteer_schedule';
 d := d || jsonb_build_object('revision',coalesce(existing_revision,0)+1);
 insert into public.event_content_settings(event_id,document,revision) values(eid,d,coalesce(existing_revision,0)+1)
 on conflict(event_id) do update set document=excluded.document,revision=excluded.revision;
 return r || jsonb_build_object('content', d);
end;
$$;

create or replace function public.save_past_event_resources(p_event_id uuid,p_revision integer,p_links jsonb,p_operation_id uuid,p_resources_version integer default null)
returns jsonb language plpgsql set search_path = '' as $$
declare e public.events; d jsonb; rev integer; r jsonb; req jsonb; receipt public.admin_event_mutations; content jsonb; item_links jsonb;
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
 if not public.event_has_ended(e) and e.canceled_at is null then raise exception 'This event has not ended. Reload before saving.' using hint='EVENT_HISTORY_LOCKED'; end if;
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
 -- Links re-insert under their own ids; carry each one's agenda item over.
 select coalesce(jsonb_object_agg(id,agenda_item_id),'{}') into item_links from public.event_links where event_id=p_event_id and agenda_item_id is not null;
 delete from public.event_links where event_id=p_event_id;
 insert into public.event_links(id,event_id,type,label,url,visibility,sort_order,agenda_item_id)
 select (value->>'id')::uuid,p_event_id,(value->>'type')::public.event_link_type,nullif(btrim(value->>'label'),''),value->>'url',(value->>'visibility')::public.event_link_visibility,ordinality-1,(item_links->>(value->>'id'))::uuid
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

notify pgrst, 'reload schema';
