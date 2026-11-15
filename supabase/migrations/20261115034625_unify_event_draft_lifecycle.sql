-- Expand phase. events owns identity and unfinished content. Keep the legacy
-- table/RPC signatures until the previous deployment and retries have retired.
alter table public.events
  add column working_document jsonb,
  add column working_revision integer not null default 0,
  add column legacy_draft_ids uuid[] not null default '{}',
  alter column description drop not null,
  alter column regular_price drop not null,
  alter column member_price drop not null,
  alter column member_price drop default,
  alter column max_capacity drop not null;
alter table public.events add constraint events_working_document_private check (
  working_document is null or (status = 'draft' and publish_at is null
    and jsonb_typeof(working_document) = 'object' and octet_length(working_document::text) <= 524288));

-- Incomplete editor text is never coerced into an invented date/amount.
create function public.draft_event_timestamp(value text) returns timestamptz
language plpgsql set search_path = '' as $$
begin
  if value is null or value = '' then return null; end if;
  return value::timestamp at time zone 'America/Vancouver';
exception when others then return null;
end $$;
create function public.draft_event_number(value text) returns numeric
language plpgsql set search_path = '' as $$
begin
  if value is null or value = '' then return null; end if;
  return value::numeric;
exception when others then return null;
end $$;

-- Existing registration guards still protect committed seats. A missing
-- capacity on an unfinished, empty draft is now a valid saved value.
do $$ declare definition text; begin
  select pg_get_functiondef('public.guard_event_registration_settings()'::regprocedure) into definition;
  definition := replace(definition, 'new.max_capacity is null or new.max_capacity < v_floor',
    '(new.max_capacity is null and v_floor > 0) or new.max_capacity < v_floor');
  definition := replace(definition, 'if v_dates is not null then',
    'if v_dates is not null and new.working_document is null then');
  execute definition;
end $$;

create function public.save_event_working_document(
  p_id uuid, p_event_id uuid, p_document jsonb, p_revision integer,
  p_event_revision integer default null, p_operation_id uuid default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  e public.events; s jsonb := p_document->'formState'; eid uuid;
  base text; candidate text; suffix text; n integer := 0; edited boolean;
  amount numeric; capacity numeric; r jsonb; req jsonb; receipt public.admin_event_mutations;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101,13);
  req := jsonb_build_object('kind','working-document','id',p_id,'event_id',p_event_id,
    'document',p_document,'revision',p_revision,'event_revision',p_event_revision);
  if p_operation_id is not null then
    select * into receipt from public.admin_event_mutations where id=p_operation_id;
    if found then
      if receipt.request <> req then raise exception 'DRAFT_CONFLICT'; end if;
      return receipt.result;
    end if;
  end if;
  if p_document->>'version' <> '1' or jsonb_typeof(s) <> 'object' then raise exception 'Invalid draft document.'; end if;
  if s->'content' is not null and s->'content' <> 'null'::jsonb then
    perform public.validate_event_content(s->'content',true);
  end if;
  select * into e from public.events where id=coalesce(p_event_id,p_id) or p_id=any(legacy_draft_ids) for update;
  if found then
    if e.status <> 'draft' or e.publish_at is not null then raise exception 'Only unscheduled drafts can save working documents.'; end if;
    eid := e.id;
  else
    if p_event_id is not null or p_revision <> 0 then raise exception 'DRAFT_CONFLICT'; end if;
    eid := p_id;
  end if;
  edited := coalesce((s->>'slug_edited')::boolean,true);
  base := nullif(s->>'page_slug','');
  if not edited and e.first_published_at is null then
    base := rtrim(left(btrim(regexp_replace(lower(btrim(coalesce(s->>'name',''))),'[^a-z0-9]+','-','g'),'-'),100),'-');
    if base = '' then base := 'event'; end if;
    if base in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings') then base := base || '-event'; end if;
  end if;
  base := coalesce(base,e.slug,'event');
  if length(base)>100 or base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or base in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings') then
    raise exception 'Use a valid, non-reserved page URL of at most 100 characters.';
  end if;
  if e.first_published_at is not null and base is distinct from e.slug then raise exception 'The page URL is locked after first publication.'; end if;
  candidate := base;
  suffix := substring(e.slug from '-[0-9]+$');
  if not edited and suffix is not null and e.slug=rtrim(left(base,100-length(suffix)),'-')||suffix then candidate:=e.slug; end if;
  loop
    exit when not exists(select 1 from public.event_url_claims where slug=candidate and event_id<>eid)
      and not exists(select 1 from public.events where slug=candidate and id<>eid);
    if edited then raise exception 'This page URL is already in use.'; end if;
    n:=n+1; suffix:='-'||n; candidate:=rtrim(left(base,100-length(suffix)),'-')||suffix;
  end loop;
  p_document := jsonb_set(p_document,'{formState,page_slug}',to_jsonb(candidate));
  -- Compatible response-loss retry. New callers additionally use receipts.
  if e.id is not null and e.working_document = p_document then
    return jsonb_build_object('id',p_id,'event_id',eid,'revision',e.working_revision,'event_revision',e.revision,'document',e.working_document);
  end if;
  if e.id is not null and (e.working_revision<>p_revision or
    (p_event_revision is not null and e.revision<>p_event_revision)) then raise exception 'DRAFT_CONFLICT'; end if;
  capacity := public.draft_event_number(s->>'max_capacity');
  if capacity is not null and (capacity<=0 or capacity<>trunc(capacity) or capacity>2147483647) then capacity:=null; end if;
  amount := case when s->>'pricing_mode'='free' then 0 when s->>'pricing_mode'='paid' then public.draft_event_number(s->>'pricing_amount') else public.draft_event_number(s->>'regular_price') end;
  if amount<0 or amount>=1000000 or amount<>round(amount,2) then amount:=null; end if;
  if e.id is null then
    insert into public.events(id,name,slug,status,description,regular_price,member_price,max_capacity)
      values(eid,coalesce(s->>'name',''),candidate,'draft',null,null,null,null);
  end if;
  update public.events set
    working_document=p_document,working_revision=p_revision+1,
    legacy_draft_ids=case when p_id<>eid and not p_id=any(legacy_draft_ids) then array_append(legacy_draft_ids,p_id) else legacy_draft_ids end,
    name=coalesce(s->>'name',''),description=nullif(s->>'description',''),short_description=nullif(s->>'short_description',''),
    description_rich=nullif(s->'description_rich','null'::jsonb),slug=candidate,configured_slug=candidate,configured_slug_edited=edited,
    image_url=nullif(s->>'image_url',''),header_image_url=nullif(s->>'header_image_url',''),
    header_colour=case when nullif(s->>'header_image_url','') is null then nullif(s->>'header_colour','') end,
    event_colour=nullif(s->>'event_colour',''),max_capacity=capacity::integer,
    regular_price=amount,member_price=case when s->>'pricing_mode' in ('free','paid') then 0 else public.draft_event_number(s->>'member_price') end,
    starts_at=public.draft_event_timestamp(s->>'starts_at'),ends_at=public.draft_event_timestamp(s->>'ends_at'),
    registration_opens_at=public.draft_event_timestamp(s->>'registration_opens_at'),registration_closes_at=public.draft_event_timestamp(s->>'registration_closes_at'),
    requires_application=coalesce((s->>'requires_application')::boolean,false),
    mentors_enabled=coalesce((s->>'mentors_enabled')::boolean,false),sponsors_enabled=coalesce((s->>'sponsors_enabled')::boolean,false),
    agenda_enabled=coalesce((s->>'agenda_enabled')::boolean,false),is_featured=coalesce((s->>'is_featured')::boolean,false)
  where id=eid returning * into e;
  r:=jsonb_build_object('id',p_id,'event_id',eid,'revision',e.working_revision,'event_revision',e.revision,'document',e.working_document);
  if p_operation_id is not null then insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r); end if;
  return r;
end $$;
revoke all on function public.save_event_working_document(uuid,uuid,jsonb,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.save_event_working_document(uuid,uuid,jsonb,integer,integer,uuid) to service_role;

create or replace function public.save_admin_event_draft(p_id uuid,p_event_id uuid,p_document jsonb,p_revision integer)
returns jsonb language plpgsql set search_path = '' as $$
begin
  return public.save_event_working_document(p_id,p_event_id,p_document,p_revision);
end $$;

-- Backfill is atomic: manual collisions stop the deployment with draft IDs;
-- no pending payload is discarded. Materialized aliases keep their event ID.
do $$ declare d public.admin_event_drafts; e public.events; r jsonb; begin
  for d in select * from public.admin_event_drafts order by updated_at,id loop
    if d.materialized then
      update public.events set legacy_draft_ids=array_append(legacy_draft_ids,d.id)
        where id=d.event_id and not d.id=any(legacy_draft_ids);
    else
      select * into e from public.events where id=d.event_id;
      if e.id is not null and (e.status<>'draft' or e.publish_at is not null) then
        raise exception 'Resolve pending legacy draft % attached to published/scheduled event % before cutover.',d.id,e.id;
      end if;
      begin
        r:=public.save_event_working_document(d.id,d.event_id,d.document,0);
      exception when others then raise exception 'Draft migration blocked for %: %',d.id,sqlerrm; end;
      update public.events set working_revision=d.revision where id=(r->>'event_id')::uuid;
      update public.admin_event_drafts set event_id=(r->>'event_id')::uuid where id=d.id;
    end if;
  end loop;
end $$;

-- Map old deployment materialization calls onto the permanent identity, then
-- reuse the established guarded transaction and response receipt machinery.
alter function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb)
  rename to save_admin_event_builder_before_unified_drafts;
create function public.save_admin_event_builder(
  p_event_id uuid,p_draft_id uuid,p_draft_revision integer,p_event jsonb,p_slug text,
  p_expected_image_url text,p_expected_header_image_url text,p_check_in_sessions jsonb,
  p_application_questions jsonb,p_mentors jsonb,p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare e public.events; eid uuid:=p_event_id;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101,13);
  if p_draft_id is not null then
    select * into e from public.events where id=coalesce(p_event_id,p_draft_id) or p_draft_id=any(legacy_draft_ids) for update;
    if not found then raise exception 'Draft not found.'; end if;
    eid:=e.id;
    if e.working_document is not null and e.working_revision<>p_draft_revision then raise exception 'DRAFT_CONFLICT'; end if;
  end if;
  return public.save_admin_event_builder_before_unified_drafts(eid,null,0,
    p_event || jsonb_build_object('working_document',null),p_slug,p_expected_image_url,p_expected_header_image_url,
    p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
end $$;
revoke all on function public.save_admin_event_builder_before_unified_drafts(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_admin_event_builder(uuid,uuid,integer,jsonb,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;

-- RLS hides unscheduled drafts (and their editor payloads) from nonstaff.
-- The database also refuses bypass publication through quick edits/cron.
create function public.guard_event_publication_readiness() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status='active' or new.publish_at is not null then
    if new.working_document is not null then raise exception 'Finish the event in Edit before publishing.' using hint='EVENT_PUBLICATION_INVALID'; end if;
    if btrim(new.name)='' or nullif(btrim(new.short_description),'') is null or
      (coalesce(new.configured_marketing_mode,'hosted')<>'disabled' and nullif(btrim(new.description),'') is null)
      or new.starts_at is null or new.ends_at is null or new.ends_at<=new.starts_at
      or new.max_capacity is null or new.regular_price is null or new.member_price is null then
      raise exception 'Finish the event in Edit before publishing.' using hint='EVENT_PUBLICATION_INVALID';
    end if;
  end if;
  return new;
end $$;
create trigger zy_event_publication_readiness before insert or update on public.events
for each row execute function public.guard_event_publication_readiness();
revoke all on function public.draft_event_timestamp(text),public.draft_event_number(text),public.guard_event_publication_readiness() from public,anon,authenticated;
