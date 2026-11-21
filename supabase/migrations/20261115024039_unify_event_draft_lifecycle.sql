-- Unified event lifecycle, expand phase. events owns identity and unfinished
-- content: a draft and its published event share one permanent ID, a saved
-- draft's URL is live immediately, and the URL locks at first publication.
-- The legacy admin_event_drafts table and RPC signatures stay (as mirrors and
-- wrappers) until the previous deployment and its retries have retired; see
-- docs/rollouts/unified-events.md.

-- 1. Columns and constraints ------------------------------------------------

alter table public.admin_event_drafts add column event_revision integer;

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

-- An unfinished draft may hold a zero capacity.
alter table public.events drop constraint events_max_capacity_check;
alter table public.events add constraint events_max_capacity_check check (max_capacity >= 0);

-- 2. A draft has one active URL ---------------------------------------------

-- Keep the legacy readers of events.slug working while the builder sends
-- configured_slug. Published URLs stay locked.
CREATE OR REPLACE FUNCTION public.sync_event_page_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.configured_slug is not null and
    (tg_op = 'INSERT' or old.first_published_at is null) then
    new.slug := new.configured_slug;
  end if;
  return new;
end;
$function$

;

create trigger sync_event_page_slug before insert or update on public.events
for each row execute function public.sync_event_page_slug();
revoke all on function public.sync_event_page_slug() from public, anon, authenticated;

-- Existing unpublished configuration becomes the canonical URL. URL claims
-- already prevent cross-event collisions; their trigger releases the old URL.
update public.events set slug = configured_slug
where first_published_at is null and configured_slug is not null
  and slug is distinct from configured_slug;

-- 3. Projection helpers -----------------------------------------------------

-- Incomplete editor text is never coerced into an invented date or amount.
-- Timestamps follow the application's pinned Pacific calendar, including
-- permanent UTC-7 from March 2026, even when the local tzdata is older.
CREATE OR REPLACE FUNCTION public.draft_event_timestamp(value text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then return null; end if;
 if value::timestamp >= timestamp '2026-03-08 03:00:00' then
   return value::timestamp at time zone 'Etc/GMT+7';
 end if;
 return value::timestamp at time zone 'America/Vancouver';
exception when others then return null;
end $function$

;

CREATE OR REPLACE FUNCTION public.draft_event_wall_time(value timestamp with time zone)
 RETURNS timestamp without time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select value at time zone (case when value >= timestamptz '2026-03-08 10:00:00Z' then 'Etc/GMT+7' else 'America/Vancouver' end)
$function$

;

CREATE OR REPLACE FUNCTION public.draft_event_number(value text)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if value is null or value = '' then return null; end if;
  return value::numeric;
exception when others then return null;
end $function$

;

CREATE OR REPLACE FUNCTION public.draft_event_integer(value text, minimum integer DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare number numeric := public.draft_event_number(value);
begin
 if number is null or number<minimum or number>2147483647 or number<>trunc(number) then return null; end if;
 return number::integer;
end $function$

;

revoke all on function public.draft_event_timestamp(text), public.draft_event_number(text),
  public.draft_event_wall_time(timestamptz) from public, anon, authenticated;
revoke all on function public.draft_event_integer(text, integer) from public, anon, authenticated;
grant execute on function public.draft_event_integer(text, integer) to service_role;

-- 4. Guards that let unfinished drafts save ---------------------------------

-- Existing registration guards still protect committed seats. A missing
-- capacity on an unfinished, empty draft is a valid saved value.
CREATE OR REPLACE FUNCTION public.guard_event_registration_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_floor integer; v_dates jsonb; v_start timestamptz; v_end timestamptz; v_document jsonb; v_location jsonb;
begin
  if new.registration_opens_at is not null and new.registration_closes_at is not null
    and new.registration_opens_at >= new.registration_closes_at then
    raise exception 'Registration end time must be after the start time.' using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  if tg_op = 'UPDATE' then
    if new.requires_application is distinct from old.requires_application and (
      exists(select 1 from public.event_tickets where event_id = old.id)
      or exists(select 1 from public.event_applications where event_id = old.id and status <> 'draft')
      or exists(select 1 from public.purchases where event_id = old.id and status <> 'failed')
    ) then
      raise exception 'Registration mode is locked because registrations or payments exist.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    if new.max_capacity is distinct from old.max_capacity then
      select tickets + held_offers into v_floor from public.event_seat_counts_unfiltered(array[old.id]);
      if (new.max_capacity is null and v_floor > 0) or new.max_capacity < v_floor then
        raise exception 'Capacity cannot be below % committed seats (tickets and held offers).', v_floor using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
    end if;
    select document into v_document from public.event_date_location_settings where event_id = old.id;
    v_dates := v_document->'dates';
    if v_dates is not null and new.working_document is null then
      select min((row->>'start_time')::timestamptz), max((row->>'end_time')::timestamptz)
      into v_start, v_end from jsonb_array_elements(v_dates) row;
      v_location := v_document->'location';
      new.location_type := (v_location->>'type')::public.event_location_type;
      new.location_building := case when v_document->>'audience' = 'going' then v_location->>'public_summary' when v_location->>'type' = 'online' then 'Online' else v_location->>'building' end;
      new.location_room := case when v_document->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'room', '') end;
      new.location_address := case when v_document->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'address', '') end;
      new.location_address_url := case when v_document->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'map_url', '') end;
      if new.starts_at is distinct from v_start or new.ends_at is distinct from v_end then
        raise exception 'Edit individual event dates in the event form.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
    end if;
  end if;
  return new;
end $function$

;

-- Unfinished sections keep their structural and URL validation; completeness
-- belongs to publication.
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

CREATE OR REPLACE FUNCTION public.guard_event_builder_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Normalize configured pricing before comparing locks. Existing callers that
  -- omit configuration retain their original legacy amounts.
  if new.configured_pricing_mode is not null and
    (tg_op = 'INSERT' or old.pricing_policy <> 'legacy' or
     (new.configured_pricing_mode, new.configured_price) is distinct from
     (old.configured_pricing_mode, old.configured_price)) then
    new.pricing_policy := 'figma';
    new.regular_price := new.configured_price;
    new.member_price := 0;
  elsif new.configured_pricing_mode is null and new.pricing_policy <> 'legacy' and new.working_document is null then
    raise exception 'Configured pricing is required.';
  end if;
  if tg_op = 'UPDATE' then
    if old.pricing_policy = 'figma' and new.pricing_policy <> 'figma' then
      raise exception 'Configured pricing cannot be removed.';
    end if;
    if old.first_published_at is not null and
      (new.slug is distinct from old.slug or new.configured_slug is distinct from old.configured_slug) then
      -- Initializing the saved configuration with the existing URL is safe.
      if not (old.configured_slug is null and new.configured_slug = old.slug and new.slug is not distinct from old.slug) then
        raise exception 'The page URL is locked after first publication.';
      end if;
    end if;
    new.first_published_at := old.first_published_at;
    if (new.regular_price, new.member_price, new.configured_pricing_mode, new.configured_price)
      is distinct from (old.regular_price, old.member_price, old.configured_pricing_mode, old.configured_price)
      and public.admin_event_pricing_locked(old.id) then
      raise exception 'Pricing is locked because registrations or payments exist.';
    end if;
  end if;
  if new.status <> 'draft' and new.first_published_at is null then new.first_published_at := now(); end if;
  if new.configured_slug is not null and
    (length(new.configured_slug) > 100 or new.configured_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or
     new.configured_slug in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings')) then
    raise exception 'Use a valid, non-reserved page URL of at most 100 characters.';
  end if;
  return new;
end;
$function$

;

-- Preserve incomplete but safe values; only valid projected date pairs reach
-- the compatibility columns. The exact editor strings stay in the document.
CREATE OR REPLACE FUNCTION public.normalize_unfinished_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.working_document is not null then
      if new.header_colour !~ '^#[0-9A-Fa-f]{6}$' then new.header_colour:=null; end if;
      if new.event_colour !~ '^#[0-9A-Fa-f]{6}$' then new.event_colour:=null; end if;
    if new.ends_at < new.starts_at then new.ends_at:=null; end if;
    if new.registration_closes_at <= new.registration_opens_at then new.registration_closes_at:=null; end if;
    if new.member_price < 0 then new.member_price:=null; end if;
  end if;
  return new;
end $function$

;

create trigger ga_normalize_unfinished_event before insert or update on public.events
for each row execute function public.normalize_unfinished_event();
revoke all on function public.normalize_unfinished_event() from public, anon, authenticated;

-- 5. Saving a working document ----------------------------------------------

-- Saves the document on the event row, projects every representable field into
-- the compatibility columns, allocates the URL under the builder lock, and
-- mirrors the document into admin_event_drafts for the previous deployment.
CREATE OR REPLACE FUNCTION public.save_event_working_document(p_id uuid, p_event_id uuid, p_document jsonb, p_revision integer, p_event_revision integer DEFAULT NULL::integer, p_operation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  e public.events; s jsonb := p_document->'formState'; eid uuid;
  base text; candidate text; suffix text; n integer := 0; edited boolean;
  amount numeric; capacity numeric; r jsonb; mirror_id uuid; saved_revision integer; req jsonb; receipt public.admin_event_mutations;
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
  if not (s ? 'pricing_mode') or s->>'configuration_initialized'='false' then
      s:=s||jsonb_build_object('configuration_initialized',true,
       'marketing_mode',coalesce(e.configured_marketing_mode,case when e.marketing_url is not null then 'external' else 'hosted' end),
       'marketing_url',coalesce(e.configured_marketing_url,e.marketing_url,''),
       'page_slug',coalesce(e.configured_slug,e.slug,s->>'page_slug',''),
       'slug_edited',coalesce(e.configured_slug_edited,(s->>'slug_edited')::boolean,true),
       'is_featured',coalesce(e.is_featured,(s->>'is_featured')::boolean,false),
       'pricing_mode',coalesce(e.configured_pricing_mode,'legacy'),
       'pricing_amount',coalesce(e.configured_price::text,e.regular_price::text,''));
    end if;
    if not (s ? 'teams_enabled') or s->>'teams_configuration_initialized'='false' then
      s:=s||jsonb_build_object('teams_configuration_initialized',true,'teams_enabled',coalesce(e.teams_enabled,false),
       'min_team_size',coalesce(e.min_team_size::text,''),'max_team_size',coalesce(e.max_team_size::text,''),
       'team_deadline',coalesce(to_char(public.draft_event_wall_time(e.team_deadline),'YYYY-MM-DD"T"HH24:MI'),''));
    end if;
    if not (s ? 'agenda_enabled') or s->>'schedule_configuration_initialized'='false' then
      s:=s||jsonb_build_object('schedule_configuration_initialized',true,'agenda_enabled',coalesce(e.agenda_enabled,false));
    end if;
    p_document:=jsonb_set(p_document,'{formState}',s);
    edited := coalesce((s->>'slug_edited')::boolean,true);
  base := nullif(s->>'page_slug','');
  if not edited and e.first_published_at is null then
    base := rtrim(left(btrim(regexp_replace(lower(btrim(coalesce(s->>'name',''))),'[^a-z0-9]+','-','g'),'-'),100),'-');
    if base = '' then base := coalesce(e.slug,'event'); end if;
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
    select event_revision into saved_revision from public.admin_event_drafts where event_id=eid and not materialized;
    r:=jsonb_build_object('id',p_id,'event_id',eid,'revision',e.working_revision,'event_revision',coalesce(saved_revision,e.revision),'document',e.working_document);
    if p_operation_id is not null then insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r); end if;
    return r;
  end if;
  if e.id is not null and (e.working_revision<>p_revision or
    (p_event_revision is not null and e.revision<>p_event_revision)) then raise exception 'DRAFT_CONFLICT'; end if;
  capacity := public.draft_event_number(s->>'max_capacity');
  if capacity is not null and (capacity<0 or capacity<>trunc(capacity) or capacity>2147483647) then capacity:=null; end if;
  amount := case when s->>'pricing_mode'='free' then 0 when s->>'pricing_mode'='paid' then public.draft_event_number(s->>'pricing_amount') else public.draft_event_number(s->>'regular_price') end;
  if amount<0 or amount>=1000000 or amount<>round(amount,2) then amount:=null; end if;
  if e.id is null then
    insert into public.events(id,name,slug,status,description,regular_price,member_price,max_capacity)
      values(eid,coalesce(s->>'name',''),candidate,'draft',null,null,null,null);
  end if;
  update public.events set
    working_document=p_document,working_revision=p_revision+1,
    legacy_draft_ids=case when p_id<>eid and not p_id=any(legacy_draft_ids) then array_append(legacy_draft_ids,p_id) else legacy_draft_ids end,
    event_type=coalesce(s->>'event_type','regular')::public.event_type,
    teams_enabled=coalesce((s->>'teams_enabled')::boolean,false),
    min_team_size=public.draft_event_integer(s->>'min_team_size',1),
    max_team_size=case when public.draft_event_integer(s->>'max_team_size',1)<public.draft_event_integer(s->>'min_team_size',1) then null else public.draft_event_integer(s->>'max_team_size',1) end,
    team_deadline=public.draft_event_timestamp(s->>'team_deadline'),
    marketing_url=case when s->>'marketing_mode'='external' and public.safe_event_content_url(s->>'marketing_url') then s->>'marketing_url' end,
    location_type=coalesce(s #>> '{date_location,location,type}',e.location_type::text,'in_person')::public.event_location_type,
    location_building=case when s #>> '{date_location,audience}'='going' then s #>> '{date_location,location,public_summary}' when s #>> '{date_location,location,type}'='online' then 'Online' else coalesce(s #>> '{date_location,location,building}',nullif(s->>'location_building','')) end,
    location_room=case when s #>> '{date_location,audience}'='going' or s #>> '{date_location,location,type}'='online' then null else coalesce(s #>> '{date_location,location,room}',nullif(s->>'location_room','')) end,
    location_address=case when s #>> '{date_location,audience}'='going' or s #>> '{date_location,location,type}'='online' then null else s #>> '{date_location,location,address}' end,
    location_address_url=case when s #>> '{date_location,audience}'='going' or s #>> '{date_location,location,type}'='online' then null else coalesce(s #>> '{date_location,location,map_url}',nullif(s->>'location_address_url','')) end,
    name=coalesce(s->>'name',''),description=nullif(s->>'description',''),short_description=nullif(s->>'short_description',''),
    description_rich=nullif(s->'description_rich','null'::jsonb),slug=candidate,configured_slug=candidate,configured_slug_edited=edited,
    image_url=nullif(s->>'image_url',''),header_image_url=nullif(s->>'header_image_url',''),
    header_colour=case when nullif(s->>'header_image_url','') is null then nullif(s->>'header_colour','') end,
    event_colour=nullif(s->>'event_colour',''),max_capacity=capacity::integer,
    configured_pricing_mode=case when amount is not null and s->>'pricing_mode' in ('free','paid') then s->>'pricing_mode' end,
     configured_price=case when amount is not null and s->>'pricing_mode' in ('free','paid') then amount end,
     configured_marketing_mode=case when s->>'marketing_mode' <> 'external' then s->>'marketing_mode' when public.safe_event_content_url(s->>'marketing_url') then 'external' end,
     configured_marketing_url=case when public.safe_event_content_url(s->>'marketing_url') then s->>'marketing_url' end,
     regular_price=amount,member_price=case when s->>'pricing_mode' in ('free','paid') then 0 else public.draft_event_number(s->>'member_price') end,
    starts_at=public.draft_event_timestamp(s->>'starts_at'),ends_at=public.draft_event_timestamp(s->>'ends_at'),
    registration_opens_at=public.draft_event_timestamp(s->>'registration_opens_at'),registration_closes_at=public.draft_event_timestamp(s->>'registration_closes_at'),
    requires_application=coalesce((s->>'requires_application')::boolean,false),
    mentors_enabled=coalesce((s->>'mentors_enabled')::boolean,false),sponsors_enabled=coalesce((s->>'sponsors_enabled')::boolean,false),
    agenda_enabled=coalesce((s->>'agenda_enabled')::boolean,false),is_featured=coalesce((s->>'is_featured')::boolean,false)
  where id=eid returning * into e;
  select id into mirror_id from public.admin_event_drafts where event_id=eid and not materialized;
    insert into public.admin_event_drafts(id,event_id,document,revision,event_revision,materialized)
     values(coalesce(mirror_id,p_id),eid,p_document,e.working_revision,e.revision,false)
     on conflict(id) do update set document=excluded.document,revision=excluded.revision,event_revision=excluded.event_revision,event_id=excluded.event_id,materialized=false,updated_at=now();
     r:=jsonb_build_object('id',p_id,'event_id',eid,'revision',e.working_revision,'event_revision',e.revision,'document',e.working_document);
  if p_operation_id is not null then insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r); end if;
  return r;
end $function$

;

revoke all on function public.save_event_working_document(uuid, uuid, jsonb, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.save_event_working_document(uuid, uuid, jsonb, integer, integer, uuid) to service_role;

-- The previous deployment's RPC becomes a wrapper. Its original body is kept
-- under a new name until the contract migration removes it.
alter function public.save_admin_event_draft(uuid, uuid, jsonb, integer)
  rename to save_admin_event_draft_before_url_activation;
CREATE OR REPLACE FUNCTION public.save_admin_event_draft(p_id uuid, p_event_id uuid, p_document jsonb, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  return public.save_event_working_document(p_id,p_event_id,p_document,p_revision);
end $function$

;

revoke all on function public.save_admin_event_draft(uuid, uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_admin_event_draft(uuid, uuid, jsonb, integer) to service_role;

-- 6. Publishing through the builder -----------------------------------------

-- Map both deployments' materialization calls onto the permanent identity,
-- arbitrate automatic URL collisions under the draft-save lock, refuse to drop
-- a saved unfinished section the caller did not send, and reuse the
-- established guarded transaction and receipt machinery. Legacy clients have a
-- durable draft identity but no operation UUID, so their receipt is derived
-- from that identity and revision.
alter function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb)
  rename to save_admin_event_builder_before_unified_drafts;
CREATE OR REPLACE FUNCTION public.save_admin_event_builder(p_event_id uuid, p_draft_id uuid, p_draft_revision integer, p_event jsonb, p_slug text, p_expected_image_url text, p_expected_header_image_url text, p_check_in_sessions jsonb, p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare e public.events; eid uuid:=p_event_id; result jsonb; op uuid; receipt public.admin_event_mutations; base text; candidate text; suffix text; counter integer:=0; canonical text; canonical_receipt jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101,13);
  op:=(p_event->>'_operation_id')::uuid;
    if op is not null then select * into receipt from public.admin_event_mutations where id=op; end if;
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
  if eid is not null then select * into e from public.events where id=eid for update; end if;
    if receipt.id is null and e.working_document is not null then
      if e.working_document #> '{formState,content}' is not null and e.working_document #> '{formState,content}' <> 'null'::jsonb
        and (p_event->'_content' is null or p_event->'_content'='null'::jsonb) then
        raise exception 'Reload saved people and resources before publishing.' using hint='EVENT_CONTENT_INVALID';
      end if;
      if e.working_document #> '{formState,date_location}' is not null and e.working_document #> '{formState,date_location}' <> 'null'::jsonb
        and (p_event->'_date_location' is null or p_event->'_date_location'='null'::jsonb) then
        raise exception 'Reload saved dates and locations before publishing.' using hint='EVENT_SETTINGS_CONFLICT';
      end if;
      if (nullif(e.working_document #>> '{formState,decisions_release_at}','') is not null or nullif(e.working_document #>> '{formState,confirmation_deadline}','') is not null)
        and (p_event->'_application_timing' is null or p_event->'_application_timing'='null'::jsonb) then
        raise exception 'Reload saved application timing before publishing.' using hint='EVENT_SETTINGS_CONFLICT';
      end if;
    end if;
    if p_event->>'configured_slug_edited'='false' then
      if receipt.id is not null and receipt.request #> '{event,configured_slug}' is not null then
        p_event:=jsonb_set(p_event,'{configured_slug}',receipt.request #> '{event,configured_slug}');
      elsif e.first_published_at is null then
        base:=rtrim(left(btrim(regexp_replace(lower(btrim(coalesce(p_event->>'name',e.name,''))),'[^a-z0-9]+','-','g'),'-'),100),'-');
        if base='' then base:=coalesce(e.slug,'event'); end if;
        if base in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings') then base:=base||'-event'; end if;
        candidate:=base; suffix:=substring(e.slug from '-[0-9]+$');
        if suffix is not null and e.slug=rtrim(left(base,100-length(suffix)),'-')||suffix then candidate:=e.slug; end if;
        loop
          exit when not exists(select 1 from public.event_url_claims where slug=candidate and event_id is distinct from eid)
            and not exists(select 1 from public.events where slug=candidate and id is distinct from eid);
          counter:=counter+1; suffix:='-'||counter; candidate:=rtrim(left(base,100-length(suffix)),'-')||suffix;
        end loop;
        p_event:=jsonb_set(p_event,'{configured_slug}',to_jsonb(candidate));
        if eid is null then p_slug:=candidate; end if;
      end if;
    end if;
    result:=public.save_admin_event_builder_before_unified_drafts(eid,null,0,
    p_event || jsonb_build_object('working_document',null),p_slug,p_expected_image_url,p_expected_header_image_url,
    p_check_in_sessions,p_application_questions,p_mentors,p_sponsors);
  update public.admin_event_drafts set materialized=true,updated_at=now() where event_id=(result->>'id')::uuid;
  select slug into canonical from public.events where id=(result->>'id')::uuid;
    canonical:=coalesce(canonical,result->>'page_slug',receipt.result->>'page_slug');
    result:=result||jsonb_build_object('page_slug',canonical);
    canonical_receipt:=result;
    if op is not null then update public.admin_event_mutations set result=canonical_receipt where id=op; end if;
    return result;
end $function$

;

revoke all on function public.save_admin_event_builder_before_unified_drafts(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

-- 7. Quick edits and deletion -----------------------------------------------

-- Quick edits update the same working document, keep every unfinished
-- section, and use the builder's revision and receipt contract. The definer is
-- limited to staff and service callers.
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
    if jsonb_array_length(document #> '{formState,date_location,dates}') > 1 and
       (e.starts_at,e.ends_at) is distinct from ((p_patch->>'starts_at')::timestamptz,(p_patch->>'ends_at')::timestamptz) then
      raise exception 'Edit individual event dates in the event form.' using hint='EVENT_SETTINGS_CONFLICT';
    end if;
    if jsonb_array_length(document #> '{formState,date_location,dates}') = 1 then
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

-- Deletion also cleans up images that only the working document references.
CREATE OR REPLACE FUNCTION public.delete_admin_event_safely(p_event_id uuid, p_operation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
     union select jsonb_path_query #>> '{}' from public.events,
       lateral jsonb_path_query(working_document,'$.**.image_url') where id=p_event_id
     union select jsonb_path_query #>> '{}' from public.events,
       lateral jsonb_path_query(working_document,'$.**.header_image_url') where id=p_event_id
     union select jsonb_path_query #>> '{}' from public.events,
       lateral jsonb_path_query(working_document,'$.**.profile_image_path') where id=p_event_id
     union select jsonb_path_query #>> '{}' from public.events,
       lateral jsonb_path_query(working_document,'$.**.brand_logo_path') where id=p_event_id
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
end $function$

;

-- 8. Publication readiness --------------------------------------------------

-- The database refuses publication of an unfinished event through any path,
-- including quick edits and the scheduler.
CREATE OR REPLACE FUNCTION public.guard_event_publication_readiness()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.status='active' or new.publish_at is not null then
    if new.working_document is not null then raise exception 'Finish the event in Edit before publishing.' using hint='EVENT_PUBLICATION_INVALID'; end if;
    if length(new.short_description)>50 or length(new.description)>3000 or btrim(new.name)='' or nullif(btrim(new.short_description),'') is null or
      (coalesce(new.configured_marketing_mode,'hosted')<>'disabled' and nullif(btrim(new.description),'') is null)
      or new.starts_at is null or new.ends_at is null or new.ends_at<=new.starts_at
      or new.max_capacity is null or new.regular_price is null or new.member_price is null then
      raise exception 'Finish the event in Edit before publishing.' using hint='EVENT_PUBLICATION_INVALID';
    end if;
  end if;
  return new;
end $function$

;

create trigger zy_event_publication_readiness before insert or update on public.events
for each row execute function public.guard_event_publication_readiness();
revoke all on function public.guard_event_publication_readiness() from public, anon, authenticated;

-- Child rows are written after the event row, so application questions are
-- checked at commit. Trusted service-role fixture and legacy inserts keep
-- their maintenance capability.
CREATE OR REPLACE FUNCTION public.guard_event_publication_questions()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare e public.events;
begin
 if tg_op='INSERT' and auth.role()='service_role' then return null; end if;
 if tg_op='UPDATE' and (new.status,new.publish_at,new.requires_application) is not distinct from (old.status,old.publish_at,old.requires_application) then return null; end if;
 select * into e from public.events where id=new.id;
 if not found then return null; end if;
 if (e.status='active' or e.publish_at is not null) and e.requires_application and not exists(
   select 1 from public.event_application_questions where event_id=e.id and nullif(btrim(question),'') is not null
 ) then raise exception 'Applications require at least one valid question before publication.' using hint='EVENT_PUBLICATION_INVALID'; end if;
 return null;
end $function$

;

create constraint trigger event_publication_questions after insert or update on public.events
  deferrable initially deferred for each row execute function public.guard_event_publication_questions();
revoke all on function public.guard_event_publication_questions() from public, anon, authenticated;

-- 9. Private fields ---------------------------------------------------------

-- The document, revision and alias fields are owned by the guarded functions
-- above. Keep existing admin column writes without granting the new fields
-- through the table-wide INSERT/UPDATE privileges. A column added to events
-- later needs its own grant to authenticated.
revoke insert, update on public.events from authenticated;
do $$ declare columns text; begin
  select string_agg(quote_ident(attname), ',' order by attnum) into columns
  from pg_attribute where attrelid = 'public.events'::regclass and attnum > 0
    and not attisdropped and attname not in ('working_document', 'working_revision', 'legacy_draft_ids');
  execute format('grant insert (%s), update (%s) on public.events to authenticated', columns, columns);
end $$;

-- 10. Backfill --------------------------------------------------------------

-- Atomic: a manual URL collision stops the deployment with the draft ID, and
-- no pending payload is discarded. Materialized aliases keep their event ID.
-- An attached document can predate a lock its event has since gained (staff
-- could register for drafts before this release). The save's own guards
-- decide: when one rejects a locked setting, only that setting is reset to the
-- event's current value and the save is retried, so every other pending edit
-- is kept and the runtime locks are unchanged. Each reset is logged by ID. Any
-- other failure, or a lock a reset cannot satisfy, still stops the deployment.
-- supabase/tests/unified-draft-migration.sql re-runs this loop.
do $$ declare d public.admin_event_drafts; e public.events; r jsonb; doc jsonb; s jsonb; err text; setting text; reset text[]; begin
  for d in select * from public.admin_event_drafts order by updated_at,id loop
    if d.materialized then
      update public.events set legacy_draft_ids=array_append(legacy_draft_ids,d.id)
        where id=d.event_id and not d.id=any(legacy_draft_ids);
    else
      select * into e from public.events where id=d.event_id;
      if e.id is not null and (e.status<>'draft' or e.publish_at is not null) then
        raise exception 'Resolve pending legacy draft % attached to published/scheduled event % before cutover.',d.id,e.id;
      end if;
      doc:=d.document; reset:='{}';
      loop
        begin
          r:=public.save_event_working_document(d.id,d.event_id,doc,0);
          exit;
        exception when others then
          err:=sqlerrm;
          setting:=case when e.id is null then null
            when err='Pricing is locked because registrations or payments exist.' then 'pricing'
            when err='Registration mode is locked because registrations or payments exist.' then 'registration mode'
            when err like 'Capacity cannot be below % committed seats%' then 'capacity'
            when err='Teams cannot be turned off because teams already exist.' then 'teams'
            when err like 'Maximum team size cannot be below %' then 'maximum team size'
            -- A published URL is fixed, so no other saved URL can be kept.
            when err='The page URL is locked after first publication.' or (e.first_published_at is not null
              and err='Use a valid, non-reserved page URL of at most 100 characters.') then 'page URL' end;
          if setting is null or setting=any(reset) then
            raise exception 'Draft migration blocked for %: %',d.id,err;
          end if;
          s:=doc->'formState';
          s:=s||case setting
            -- Projects back to the event's exact pricing columns, written as
            -- the builder writes amounts. A document without pricing_mode
            -- takes the event's configuration in the save.
            when 'pricing' then jsonb_build_object('regular_price',coalesce(trim_scale(e.regular_price)::text,''),
                'member_price',coalesce(trim_scale(e.member_price)::text,''))
              ||case when s ? 'pricing_mode' then jsonb_build_object('pricing_mode',coalesce(e.configured_pricing_mode,'legacy'),
                'pricing_amount',coalesce(trim_scale(coalesce(e.configured_price,e.regular_price))::text,'')) else '{}'::jsonb end
            when 'registration mode' then jsonb_build_object('requires_application',e.requires_application)
            when 'capacity' then jsonb_build_object('max_capacity',coalesce(e.max_capacity::text,''))
            when 'teams' then jsonb_build_object('teams_enabled',e.teams_enabled)
            when 'maximum team size' then jsonb_build_object('max_team_size',coalesce(e.max_team_size::text,''))
            when 'page URL' then jsonb_build_object('page_slug',e.slug) end;
          doc:=jsonb_set(doc,'{formState}',s);
          reset:=reset||setting;
        end;
      end loop;
      if cardinality(reset)>0 then
        -- A warning, not a notice: db push prints neither, but the server
        -- log keeps warnings.
        raise warning 'Draft % kept the locked % of event %; its other edits are unchanged.',d.id,array_to_string(reset,', '),e.id;
      end if;
      update public.events set working_revision=d.revision where id=(r->>'event_id')::uuid;
      update public.admin_event_drafts set event_id=(r->>'event_id')::uuid where id=d.id;
    end if;
  end loop;
end $$;

-- Bring each mirror row's revisions in line with the restored document
-- revision. The temporary marker only forces the save to re-project.
do $$ declare e public.events; result jsonb; begin
 for e in select * from public.events where working_document is not null order by id for update loop
   update public.events set working_document=working_document||jsonb_build_object('_unified_projection_reconcile',gen_random_uuid()) where id=e.id;
   result:=public.save_event_working_document(e.id,e.id,e.working_document,e.working_revision);
   update public.events set working_revision=e.working_revision where id=e.id;
   update public.admin_event_drafts d set revision=saved.working_revision,event_revision=saved.revision,document=saved.working_document
     from public.events saved where saved.id=e.id and d.event_id=e.id and not d.materialized;
 end loop;
end $$;
