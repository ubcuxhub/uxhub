-- Preserve saved event revision in compatibility retries, even after another
-- writer changes the row. Modern callers use immutable operation receipts.
do $$ declare definition text; begin
 select pg_get_functiondef('public.save_event_working_document(uuid,uuid,jsonb,integer,integer,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'amount numeric; capacity numeric; r jsonb;', 'amount numeric; capacity numeric; r jsonb; mirror_id uuid; saved_revision integer;');
 definition:=replace(definition,'return jsonb_build_object(''id'',p_id,''event_id'',eid,''revision'',e.working_revision,''event_revision'',e.revision,''document'',e.working_document);',
   'select event_revision into saved_revision from public.admin_event_drafts where event_id=eid and not materialized;
    r:=jsonb_build_object(''id'',p_id,''event_id'',eid,''revision'',e.working_revision,''event_revision'',coalesce(saved_revision,e.revision),''document'',e.working_document);
    if p_operation_id is not null then insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r); end if;
    return r;');
 definition:=replace(definition,'insert into public.admin_event_drafts(id,event_id,document,revision,event_revision,materialized)',
   'select id into mirror_id from public.admin_event_drafts where event_id=eid and not materialized;
    insert into public.admin_event_drafts(id,event_id,document,revision,event_revision,materialized)');
 definition:=replace(definition,'values(p_id,eid,p_document,e.working_revision,e.revision,false)',
   'values(coalesce(mirror_id,p_id),eid,p_document,e.working_revision,e.revision,false)');
 execute definition;
 select pg_get_functiondef('public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'eid:=e.id;',
   'eid:=e.id;
    if p_event_id is null and e.working_document is not null then
      p_event:=p_event || jsonb_build_object(''_expected_revision'',e.revision);
      p_expected_image_url:=e.image_url; p_expected_header_image_url:=e.header_image_url;
    end if;');
 execute definition;
end $$;

-- Legacy clients had a durable draft identity but no operation UUID. Derive
-- their publication receipt from that identity/revision, preserving response-
-- loss retries through old and new deployments without rematerializing children.
create or replace function public.save_admin_event_builder(
  p_event_id uuid,p_draft_id uuid,p_draft_revision integer,p_event jsonb,p_slug text,
  p_expected_image_url text,p_expected_header_image_url text,p_check_in_sessions jsonb,
  p_application_questions jsonb,p_mentors jsonb,p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare e public.events; eid uuid:=p_event_id; result jsonb; op uuid; receipt public.admin_event_mutations;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101,13);
  if p_draft_id is not null then
    op:=coalesce((p_event->>'_operation_id')::uuid,md5('legacy-event-builder:'||p_draft_id||':'||p_draft_revision)::uuid);
    p_event:=p_event||jsonb_build_object('_operation_id',op);
    select * into receipt from public.admin_event_mutations where id=op;
    select * into e from public.events where id=coalesce(p_event_id,p_draft_id) or p_draft_id=any(legacy_draft_ids) for update;
    if not found then raise exception 'Draft not found.'; end if;
    eid:=e.id;
    if e.working_document is not null and e.working_revision<>p_draft_revision and receipt.id is null then raise exception 'DRAFT_CONFLICT'; end if;
    if p_event_id is null then
      if receipt.id is not null then
        p_event:=p_event||jsonb_build_object('_expected_revision',receipt.request #> '{event,_expected_revision}');
        p_expected_image_url:=receipt.request->>'image';
        p_expected_header_image_url:=receipt.request->>'header';
      elsif e.working_document is not null then
        p_event:=p_event||jsonb_build_object('_expected_revision',e.revision);
        p_expected_image_url:=e.image_url; p_expected_header_image_url:=e.header_image_url;
      end if;
    end if;
  end if;
  result:=public.save_admin_event_builder_before_unified_drafts(eid,null,0,
    p_event || jsonb_build_object('working_document',null),p_slug,p_expected_image_url,p_expected_header_image_url,
    p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
  update public.admin_event_drafts set materialized=true,updated_at=now() where event_id=(result->>'id')::uuid;
  return result;
end $$;
