-- Staff editor state is separate from viewer-scoped links and shared directories.
create table public.event_content_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0)
);
alter table public.event_content_settings enable row level security;
revoke all on public.event_content_settings from anon, authenticated;
grant select on public.event_content_settings to authenticated;
grant all on public.event_content_settings to service_role;
create policy "staff read event content editor" on public.event_content_settings
for select to authenticated using (public.is_admin());

alter table public.mentors add column owner_event_id uuid references public.events(id) on delete cascade;
alter table public.sponsors add column owner_event_id uuid references public.events(id) on delete cascade;

create function public.safe_event_content_url(p_url text) returns boolean
language sql immutable set search_path = '' as $$
 select p_url ~* '^https?://[^/@[:space:]\\]+([/?#][^[:space:]\\]*)?$';
$$;

-- Used on the database boundary as well as by the application validator.
create function public.validate_event_content(p_document jsonb, p_draft boolean default false)
returns void language plpgsql set search_path = '' as $$
declare s jsonb; i jsonb; l jsonb; titles text[] := '{}'; groups text[] := '{}'; t text;
begin
 if jsonb_typeof(p_document) <> 'object' or jsonb_typeof(p_document->'sections') <> 'array' or jsonb_typeof(p_document->'links') <> 'array'
 or jsonb_array_length(p_document->'sections') > 100 or jsonb_array_length(p_document->'links') > 100 then
   raise exception 'Invalid people and resource content.' using hint = 'EVENT_CONTENT_INVALID';
 end if;
 for s in select value from jsonb_array_elements(p_document->'sections') loop
   perform (s->>'key')::uuid;
   t := lower(btrim(s->>'title'));
   if coalesce(t, '') = '' or length(t) > 120 or t = any(titles) or jsonb_typeof(s->'items') <> 'array' then
     raise exception 'Section names must be nonblank and unique.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   titles := array_append(titles, t);
   if s->>'kind' not in ('Judges','Mentors','Speakers','Panelists','Sponsors','custom') or s->>'kind' is null then
     raise exception 'Invalid section group.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   if s->>'kind' <> 'custom' then
     if s->>'title' <> s->>'kind' or s->>'kind' = any(groups) then raise exception 'Each predefined group can only be added once with its fixed name.' using hint = 'EVENT_CONTENT_INVALID'; end if;
     groups := array_append(groups, s->>'kind');
   elsif t in ('judges','mentors','speakers','panelists','sponsors') then
     raise exception 'Custom sections cannot use a predefined group name.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   if jsonb_array_length(s->'items') = 0 then raise exception 'Add at least one item or remove this section.' using hint = 'EVENT_CONTENT_INVALID'; end if;
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
   if (l->>'type') not in ('slack_workspace','participant_package','event_recap','other') or l->>'type' is null
    or (l->>'visibility') not in ('everyone','going','after_event') or l->>'visibility' is null then
     raise exception 'Invalid resource type or audience.' using hint = 'EVENT_CONTENT_INVALID';
   end if;
   if (not p_draft or coalesce(l->>'url','') <> '') and not coalesce(public.safe_event_content_url(l->>'url'), false) then raise exception 'Resource links must use a safe HTTP or HTTPS URL.' using hint = 'EVENT_CONTENT_INVALID'; end if;
   if not p_draft and l->>'type' = 'other' and coalesce(btrim(l->>'label'),'') = '' then raise exception 'Other links need a label.' using hint = 'EVENT_CONTENT_INVALID'; end if;
 end loop;
end;
$$;

create function public.guard_draft_event_content() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.document->'formState'->'content' is not null and new.document->'formState'->'content' <> 'null'::jsonb then
   perform public.validate_event_content(new.document->'formState'->'content', true);
 end if;
 return new;
end;
$$;
create trigger validate_draft_event_content before insert or update of document on public.admin_event_drafts
for each row execute function public.guard_draft_event_content();

alter function public.save_admin_event_atomically(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb)
rename to save_admin_event_before_content;
create function public.save_admin_event_atomically(
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
       if item->>'directory_id' is not null then
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
       if item->>'directory_id' is not null then
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
 from jsonb_array_elements(d->'links') with ordinality;
 d := d || jsonb_build_object('revision',coalesce(existing_revision,0)+1);
 insert into public.event_content_settings(event_id,document,revision) values(eid,d,coalesce(existing_revision,0)+1)
 on conflict(event_id) do update set document=excluded.document,revision=excluded.revision;
 return r || jsonb_build_object('content', d);
end;
$$;
revoke all on function public.save_admin_event_before_content(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.save_admin_event_atomically(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_admin_event_atomically(uuid,jsonb,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
revoke all on function public.validate_event_content(jsonb,boolean), public.guard_draft_event_content() from public,anon,authenticated;
grant execute on function public.validate_event_content(jsonb,boolean) to service_role;
