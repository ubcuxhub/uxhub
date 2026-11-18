-- Create the first staff resource without a full builder save, in every event state.
-- Use the builder lock order and receipts so response-loss retries are harmless.
create function public.create_staff_volunteer_schedule(p_event_id uuid, p_url text, p_operation_id uuid)
returns jsonb language plpgsql set search_path='' as $$
declare
 e public.events; receipt public.admin_event_mutations; req jsonb; result jsonb;
 link jsonb; content jsonb; doc jsonb; links jsonb; content_revision integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 req := jsonb_build_object('kind','create-staff-schedule','event_id',p_event_id,'url',p_url);
 if p_operation_id is null then raise exception 'An operation ID is required.' using hint='EVENT_REVISION_CONFLICT'; end if;
 select * into receipt from public.admin_event_mutations where id=p_operation_id;
 if found then
  if receipt.request is distinct from req then raise exception 'This retry differs from the original request.' using hint='EVENT_REVISION_CONFLICT'; end if;
  return receipt.result;
 end if;
 if not public.safe_staff_schedule_url(p_url) then
  raise exception 'Use an absolute HTTPS URL without a username or password.' using hint='EVENT_CONTENT_INVALID';
 end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'This event no longer exists.' using hint='EVENT_REVISION_CONFLICT'; end if;
 if exists(select 1 from public.event_staff_volunteer_schedules where event_id=p_event_id) then
  raise exception 'A volunteer schedule already exists.' using hint='STAFF_SCHEDULE_EXISTS';
 end if;
 link := jsonb_build_object('id',gen_random_uuid(),'type','volunteer_schedule','visibility','staff',
   'label','Volunteer Schedule','label_edited',true,'url',p_url);
 insert into public.event_staff_volunteer_schedules(event_id,id,label,url,sort_order)
 values(p_event_id,(link->>'id')::uuid,link->>'label',p_url,(select count(*) from public.event_links where event_id=p_event_id));

 -- Keep saved sections and other links byte-for-byte; do not materialize legacy
 -- people into an empty settings document (the reader reconstructs them).
 select document,revision into content,content_revision from public.event_content_settings where event_id=p_event_id;
 if content is not null then
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into links
   from jsonb_array_elements(content->'links') with ordinality where value->>'type'<>'volunteer_schedule';
  content := content || jsonb_build_object('links',links||jsonb_build_array(link),'revision',content_revision+1,'resources_version',2);
  update public.event_content_settings set document=content,revision=content_revision+1 where event_id=p_event_id;
 end if;
 doc := e.working_document;
 -- Null content delegates recovery to the existing legacy-content adapter;
 -- do not replace its people/resources with an invented empty document.
 if nullif(doc #> '{formState,content}','null'::jsonb) is not null then
  content := doc #> '{formState,content}';
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into links
   from jsonb_array_elements(content->'links') with ordinality where value->>'type'<>'volunteer_schedule';
  content := content || jsonb_build_object('links',links||jsonb_build_array(link),'resources_version',2);
  -- A working document's content revision tracks its materialized settings.
  if content_revision is not null then content:=content||jsonb_build_object('revision',content_revision+1); end if;
  doc := jsonb_set(doc,'{formState,content}',content);
 end if;
 update public.events set working_document=doc,
   working_revision=working_revision+case when doc is null then 0 else 1 end
 where id=p_event_id returning * into e;
 update public.admin_event_drafts set document=e.working_document,revision=e.working_revision,
   event_revision=e.revision,updated_at=now()
 where event_id=p_event_id and not materialized and e.working_document is not null;
 result := jsonb_build_object('id',e.id,'url',p_url,'revision',e.revision);
 insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,result);
 return result;
end $$;
revoke all on function public.create_staff_volunteer_schedule(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_staff_volunteer_schedule(uuid,text,uuid) to service_role;
