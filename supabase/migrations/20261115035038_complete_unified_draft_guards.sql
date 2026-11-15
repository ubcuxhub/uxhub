-- Complete expand-phase compatibility and cleanup. No legacy table is removed
-- while a previous deployment can still read it.
do $$ declare definition text; begin
  select pg_get_functiondef('public.save_event_working_document(uuid,uuid,jsonb,integer,integer,uuid)'::regprocedure) into definition;
  -- Incomplete sections are recoverable; full publication validation still
  -- applies in the existing materializer. Application structural parsing
  -- rejects executable content before calling this service-only RPC.
  definition := replace(definition, 'perform public.validate_event_content(s->''content'',true);','null;');
  definition := replace(definition, 'regular_price=amount,member_price=',
    'configured_pricing_mode=case when amount is not null and s->>''pricing_mode'' in (''free'',''paid'') then s->>''pricing_mode'' end,
     configured_price=case when amount is not null and s->>''pricing_mode'' in (''free'',''paid'') then amount end,
     configured_marketing_mode=case when s->>''marketing_mode'' <> ''external'' then s->>''marketing_mode'' when public.safe_event_content_url(s->>''marketing_url'') then ''external'' end,
     configured_marketing_url=case when public.safe_event_content_url(s->>''marketing_url'') then s->>''marketing_url'' end,
     regular_price=amount,member_price=');
  definition := replace(definition, 'r:=jsonb_build_object(''id'',p_id',
    'insert into public.admin_event_drafts(id,event_id,document,revision,event_revision,materialized)
     values(p_id,eid,p_document,e.working_revision,e.revision,false)
     on conflict(id) do update set document=excluded.document,revision=excluded.revision,event_revision=excluded.event_revision,event_id=excluded.event_id,materialized=false,updated_at=now();
     r:=jsonb_build_object(''id'',p_id');
  execute definition;
end $$;

-- Preserve incomplete but safe nested values; only valid projected date pairs
-- reach compatibility columns. Their exact editor strings remain in the row.
create function public.normalize_unfinished_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.working_document is not null then
    if new.ends_at < new.starts_at then new.ends_at:=null; end if;
    if new.registration_closes_at <= new.registration_opens_at then new.registration_closes_at:=null; end if;
    if new.member_price < 0 then new.member_price:=null; end if;
  end if;
  return new;
end $$;
create trigger ga_normalize_unfinished_event before insert or update on public.events
for each row execute function public.normalize_unfinished_event();
revoke all on function public.normalize_unfinished_event() from public,anon,authenticated;

-- Keep old deployment lists/editors consistent after a full save.
do $$ declare definition text; begin
  select pg_get_functiondef('public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure) into definition;
  definition:=replace(definition,'declare e public.events; eid uuid:=p_event_id;', 'declare e public.events; eid uuid:=p_event_id; result jsonb;');
  definition:=replace(definition,'return public.save_admin_event_builder_before_unified_drafts(', 'result := public.save_admin_event_builder_before_unified_drafts(');
  definition:=replace(definition,'p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);',
    'p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
     update public.admin_event_drafts set materialized=true,updated_at=now() where event_id=(result->>''id'')::uuid;
     return result;');
  execute definition;
end $$;

-- Draft deletion receipts retain unfinished images even after the row is gone.
do $$ declare definition text; begin
  select pg_get_functiondef('public.delete_admin_event_safely(uuid,uuid)'::regprocedure) into definition;
  definition:=replace(definition,'union select header_image_url from public.events where id=p_event_id',
    'union select header_image_url from public.events where id=p_event_id
     union select value #>> ''{}'' from public.events,
       lateral jsonb_path_query(working_document,''$.**.image_url'') where id=p_event_id
     union select value #>> ''{}'' from public.events,
       lateral jsonb_path_query(working_document,''$.**.header_image_url'') where id=p_event_id
     union select value #>> ''{}'' from public.events,
       lateral jsonb_path_query(working_document,''$.**.profile_image_path'') where id=p_event_id
     union select value #>> ''{}'' from public.events,
       lateral jsonb_path_query(working_document,''$.**.brand_logo_path'') where id=p_event_id');
  execute definition;
end $$;

-- Quick edits preserve every unfinished section and update the same document.
create or replace function public.update_admin_event_schedule(p_event_id uuid,p_patch jsonb)
returns setof public.events language plpgsql set search_path = '' as $$
declare e public.events; document jsonb; field text;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 select * into e from public.events where id=p_event_id for update;
 if not found then return; end if;
 if p_patch ? '_expected_revision' and e.revision<>(p_patch->>'_expected_revision')::integer then
   raise exception 'This event changed in another tab. Reload before saving.' using hint='EVENT_REVISION_CONFLICT';
 end if;
 if public.event_has_ended(e) then raise exception 'This event has ended. Only links and resources can be updated.' using hint='EVENT_HISTORY_LOCKED'; end if;
 document:=e.working_document;
 if document is not null then
   foreach field in array array['starts_at','ends_at','registration_opens_at','registration_closes_at'] loop
     document:=jsonb_set(document,array['formState',field],to_jsonb(coalesce(to_char((p_patch->>field)::timestamptz at time zone 'America/Vancouver','YYYY-MM-DD"T"HH24:MI'),'')));
   end loop;
 end if;
 return query update public.events set status=(p_patch->>'status')::public.event_status,
  working_document=document,working_revision=working_revision+case when document is not null then 1 else 0 end,
  publish_at=(p_patch->>'publish_at')::timestamptz,starts_at=(p_patch->>'starts_at')::timestamptz,ends_at=(p_patch->>'ends_at')::timestamptz,
  registration_opens_at=(p_patch->>'registration_opens_at')::timestamptz,registration_closes_at=(p_patch->>'registration_closes_at')::timestamptz
 where id=p_event_id returning *;
end $$;
