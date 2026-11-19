-- Keep one compatible signature and combine cancellation access with private
-- schedule synchronization/retries. The schedule migration already removes the
-- legacy overload when replayed after cancellation; tolerate its absence.
drop function if exists public.save_past_event_resources(uuid,integer,jsonb,uuid);

create or replace function public.save_past_event_resources(p_event_id uuid,p_revision integer,p_links jsonb,p_operation_id uuid,p_resources_version integer default null)
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

notify pgrst, 'reload schema';
