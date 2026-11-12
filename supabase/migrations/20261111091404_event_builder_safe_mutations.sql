-- Revisions cover every events-row writer (including overview and publisher).
alter table public.events add column revision integer not null default 0;
create function public.event_has_ended(e public.events) returns boolean
language sql stable set search_path = '' as $$
 select e.status = 'active' and coalesce(e.ends_at,e.starts_at) <= now()
$$;
create function public.guard_event_history_and_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
 if current_user <> 'service_role' and public.event_has_ended(old) and
    (to_jsonb(new) - 'revision' - 'updated_at') is distinct from (to_jsonb(old) - 'revision' - 'updated_at') then
   raise exception 'This event has ended. Only links and resources can be updated.' using hint = 'EVENT_HISTORY_LOCKED';
 end if;
 new.revision := old.revision + 1;
 return new;
end $$;
create trigger zz_event_history_and_revision before update on public.events
for each row execute function public.guard_event_history_and_revision();

-- Receipts survive deletion and contain only the operation's saved response.
-- Only guarded server actions can access them; no browser direct read/write.
create table public.admin_event_mutations (
 id uuid primary key,
 request jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.admin_event_mutations enable row level security;
revoke all on public.admin_event_mutations from public,anon,authenticated;
grant all on public.admin_event_mutations to service_role;

alter function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb)
rename to save_admin_event_builder_before_safe_mutations;
create function public.save_admin_event_builder(
 p_event_id uuid,p_draft_id uuid,p_draft_revision integer,p_event jsonb,p_slug text,
 p_expected_image_url text,p_expected_header_image_url text,p_check_in_sessions jsonb,
 p_application_questions jsonb,p_mentors jsonb,p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
 e public.events; op uuid := (p_event->>'_operation_id')::uuid;
 req jsonb; receipt public.admin_event_mutations; r jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 req := jsonb_build_object('event_id',p_event_id,'draft_id',p_draft_id,'draft_revision',p_draft_revision,
  'event',p_event,'image',p_expected_image_url,'header',p_expected_header_image_url,
  'sessions',p_check_in_sessions,'questions',p_application_questions,'mentors',p_mentors,'sponsors',p_sponsors);
 if op is not null then
  select * into receipt from public.admin_event_mutations where id=op;
  if found then
   if receipt.request <> req then raise exception 'This retry differs from the original request. Review the saved event before saving again.' using hint='EVENT_REVISION_CONFLICT'; end if;
   return receipt.result;
  end if;
 end if;
 -- Preserve scheduler/draft/event lock order in the existing wrapper.
 if p_draft_id is not null then perform 1 from public.admin_event_drafts where id=p_draft_id for update; end if;
 if p_event_id is not null then
  select * into e from public.events where id=p_event_id for update;
  if not found then raise exception 'This event no longer exists.' using hint='EVENT_REVISION_CONFLICT'; end if;
  if p_event ? '_expected_revision' and e.revision <> (p_event->>'_expected_revision')::integer then
   raise exception 'This event changed in another tab. Your edits are still here. Reload the saved event before updating.' using hint='EVENT_REVISION_CONFLICT';
  end if;
  if public.event_has_ended(e) then raise exception 'This event has ended. Only links and resources can be updated.' using hint='EVENT_HISTORY_LOCKED'; end if;
 end if;
 r := public.save_admin_event_builder_before_safe_mutations(p_event_id,p_draft_id,p_draft_revision,
  p_event - '_operation_id' - '_expected_revision',p_slug,p_expected_image_url,p_expected_header_image_url,
  p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
 select * into e from public.events where id=(r->>'id')::uuid;
 r := r || jsonb_build_object('revision',e.revision);
 if op is not null then insert into public.admin_event_mutations(id,request,result) values(op,req,r); end if;
 return r;
end $$;
revoke all on function public.save_admin_event_builder_before_safe_mutations(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;

-- A separate links-only operation avoids resaving obsolete dates or touching
-- historical people, questions, teams, attendance and registration settings.
create function public.save_past_event_resources(p_event_id uuid,p_revision integer,p_links jsonb,p_operation_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare e public.events; d jsonb; rev integer; r jsonb; req jsonb; receipt public.admin_event_mutations;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 req := jsonb_build_object('event_id',p_event_id,'revision',p_revision,'links',p_links,'kind','resources');
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
 perform public.validate_event_content(jsonb_build_object('revision',0,'sections','[]'::jsonb,'links',p_links));
 if exists(select 1 from jsonb_array_elements(p_links) l join public.event_links el on el.id=(l->>'id')::uuid where el.event_id<>p_event_id) then
  raise exception 'Resource belongs to another event.' using hint='EVENT_CONTENT_INVALID';
 end if;
 select document,revision into d,rev from public.event_content_settings where event_id=p_event_id;
 -- No content-settings row is needed for legacy people: the read helper still
 -- reconstructs those sections while reading the canonical resource rows.
 delete from public.event_links where event_id=p_event_id;
 insert into public.event_links(id,event_id,type,label,url,visibility,sort_order)
 select (value->>'id')::uuid,p_event_id,(value->>'type')::public.event_link_type,nullif(btrim(value->>'label'),''),value->>'url',(value->>'visibility')::public.event_link_visibility,ordinality-1
 from jsonb_array_elements(p_links) with ordinality;
 if d is not null then
  d := d || jsonb_build_object('links',p_links,'revision',rev+1);
  update public.event_content_settings set document=d,revision=rev+1 where event_id=p_event_id;
 end if;
 update public.events set revision=revision+1 where id=p_event_id returning * into e;
 r := jsonb_build_object('id',e.id,'revision',e.revision,'content',d);
 insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r);
 return r;
end $$;
revoke all on function public.save_past_event_resources(uuid,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_past_event_resources(uuid,integer,jsonb,uuid) to service_role;

-- Authenticated direct writes cannot bypass historical child-field locks.
-- Service-role legacy/seed data maintenance remains trusted; guarded builder
-- actions above never use that capability to change ended content.
create function public.guard_historical_event_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare eid uuid; e public.events;
begin
 if auth.role() = 'service_role' then return coalesce(new,old); end if;
 if tg_op <> 'INSERT' then
  eid := old.event_id;
  select * into e from public.events where id=eid for update;
  if found and public.event_has_ended(e) then raise exception 'Historical event details are locked.' using hint='EVENT_HISTORY_LOCKED'; end if;
 end if;
 if tg_op <> 'DELETE' then
  eid := new.event_id;
  select * into e from public.events where id=eid for update;
  if found and public.event_has_ended(e) then raise exception 'Historical event details are locked.' using hint='EVENT_HISTORY_LOCKED'; end if;
 end if;
 return coalesce(new,old);
end $$;
do $$ declare t text; begin
 foreach t in array array['check_in_sessions','event_application_questions','event_application_settings','event_date_location_settings','event_people_sections','event_mentors','event_sponsors','event_private_details'] loop
  execute format('create trigger guard_historical_fields before insert or update or delete on public.%I for each row execute function public.guard_historical_event_child()',t);
 end loop;
end $$;

-- Overview writes use the same lock and historical check as the builder.
create function public.update_admin_event_schedule(p_event_id uuid,p_patch jsonb)
returns setof public.events language plpgsql set search_path = '' as $$
declare e public.events;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 select * into e from public.events where id=p_event_id for update;
 if not found then return; end if;
 if public.event_has_ended(e) then raise exception 'This event has ended. Only links and resources can be updated.' using hint='EVENT_HISTORY_LOCKED'; end if;
 return query update public.events set status=(p_patch->>'status')::public.event_status,
  publish_at=(p_patch->>'publish_at')::timestamptz,starts_at=(p_patch->>'starts_at')::timestamptz,ends_at=(p_patch->>'ends_at')::timestamptz,
  registration_opens_at=(p_patch->>'registration_opens_at')::timestamptz,registration_closes_at=(p_patch->>'registration_closes_at')::timestamptz
 where id=p_event_id returning *;
end $$;
revoke all on function public.update_admin_event_schedule(uuid,jsonb) from public,anon;
grant execute on function public.update_admin_event_schedule(uuid,jsonb) to authenticated,service_role;

-- Lock the event before examining purchases. FK inserts take a key-share lock,
-- so no new purchase can slip between the refusal and the final delete.
alter function public.delete_event_atomically(uuid) rename to delete_event_before_safe_mutations;
create function public.delete_event_atomically(target_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.events where id=target_event_id for update;
 perform public.delete_event_before_safe_mutations(target_event_id);
end $$;
revoke all on function public.delete_event_before_safe_mutations(uuid), public.delete_event_atomically(uuid) from public,anon,authenticated;
grant execute on function public.delete_event_atomically(uuid) to service_role;

-- Delete receipts retain cleanup targets even when the response is lost.
create function public.delete_admin_event_safely(p_event_id uuid,p_operation_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare receipt public.admin_event_mutations; r jsonb; req jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 req := jsonb_build_object('kind','delete','event_id',p_event_id);
 select * into receipt from public.admin_event_mutations where id=p_operation_id;
 if found then
  if receipt.request <> req then raise exception 'Invalid deletion retry.'; end if;
  return receipt.result;
 end if;
 perform 1 from public.events where id=p_event_id for update;
 r := jsonb_build_object('images',coalesce((
  select jsonb_agg(url) from (
   select image_url url from public.events where id=p_event_id
   union select header_image_url from public.events where id=p_event_id
   union select profile_image_path from public.mentors where owner_event_id=p_event_id
   union select brand_logo_path from public.sponsors where owner_event_id=p_event_id
  ) images where url is not null
 ),'[]'::jsonb),'files',coalesce((
  select jsonb_agg(response) from public.event_application_responses r
  join public.event_application_questions q on q.id=r.event_application_question_id
  where q.event_id=p_event_id and q.response_type='file_upload' and r.response is not null
 ),'[]'::jsonb));
 perform public.delete_event_atomically(p_event_id);
 insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r);
 return r;
end $$;
revoke all on function public.delete_admin_event_safely(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_admin_event_safely(uuid,uuid) to service_role;
