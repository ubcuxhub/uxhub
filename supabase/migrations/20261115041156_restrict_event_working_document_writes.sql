-- The private document/revision/alias fields are owned by guarded transactions.
-- Keep existing admin column writes available, without granting the new fields
-- through the old table-wide INSERT/UPDATE privileges.
revoke insert,update on public.events from authenticated;
do $$ declare columns text; begin
 select string_agg(quote_ident(attname),',' order by attnum) into columns
 from pg_attribute where attrelid='public.events'::regclass and attnum>0
   and not attisdropped and attname not in ('working_document','working_revision','legacy_draft_ids');
 execute format('grant insert (%s), update (%s) on public.events to authenticated',columns,columns);
end $$;

-- Project every representable compatibility field, preserving older documents
-- that predate pricing/marketing/team/schedule configuration.
create function public.draft_event_integer(value text, minimum integer default 0) returns integer
language plpgsql set search_path = '' as $$
declare number numeric := public.draft_event_number(value);
begin
 if number is null or number<minimum or number>2147483647 or number<>trunc(number) then return null; end if;
 return number::integer;
end $$;
revoke all on function public.draft_event_integer(text,integer) from public,anon,authenticated;
grant execute on function public.draft_event_integer(text,integer) to service_role;

do $$ declare definition text; begin
 select pg_get_functiondef('public.save_event_working_document(uuid,uuid,jsonb,integer,integer,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'  edited := coalesce',
   '  if not (s ? ''pricing_mode'') or s->>''configuration_initialized''=''false'' then
      s:=s||jsonb_build_object(''configuration_initialized'',true,
       ''marketing_mode'',coalesce(e.configured_marketing_mode,case when e.marketing_url is not null then ''external'' else ''hosted'' end),
       ''marketing_url'',coalesce(e.configured_marketing_url,e.marketing_url,''''),
       ''page_slug'',coalesce(e.configured_slug,e.slug,s->>''page_slug'',''''),
       ''slug_edited'',coalesce(e.configured_slug_edited,(s->>''slug_edited'')::boolean,true),
       ''is_featured'',coalesce(e.is_featured,(s->>''is_featured'')::boolean,false),
       ''pricing_mode'',coalesce(e.configured_pricing_mode,''legacy''),
       ''pricing_amount'',coalesce(e.configured_price::text,e.regular_price::text,''''));
    end if;
    if not (s ? ''teams_enabled'') or s->>''teams_configuration_initialized''=''false'' then
      s:=s||jsonb_build_object(''teams_configuration_initialized'',true,''teams_enabled'',coalesce(e.teams_enabled,false),
       ''min_team_size'',coalesce(e.min_team_size::text,''''),''max_team_size'',coalesce(e.max_team_size::text,''''),
       ''team_deadline'',coalesce(to_char(public.draft_event_wall_time(e.team_deadline),''YYYY-MM-DD"T"HH24:MI''),''''));
    end if;
    if not (s ? ''agenda_enabled'') or s->>''schedule_configuration_initialized''=''false'' then
      s:=s||jsonb_build_object(''schedule_configuration_initialized'',true,''agenda_enabled'',coalesce(e.agenda_enabled,false));
    end if;
    p_document:=jsonb_set(p_document,''{formState}'',s);
    edited := coalesce');
 definition:=replace(definition,'capacity<=0','capacity<0');
 definition:=replace(definition,'name=coalesce(s->>''name'',''''),description=',
   'event_type=coalesce(s->>''event_type'',''regular'')::public.event_type,
    teams_enabled=coalesce((s->>''teams_enabled'')::boolean,false),
    min_team_size=public.draft_event_integer(s->>''min_team_size'',1),
    max_team_size=case when public.draft_event_integer(s->>''max_team_size'',1)<public.draft_event_integer(s->>''min_team_size'',1) then null else public.draft_event_integer(s->>''max_team_size'',1) end,
    team_deadline=public.draft_event_timestamp(s->>''team_deadline''),
    marketing_url=case when s->>''marketing_mode''=''external'' and public.safe_event_content_url(s->>''marketing_url'') then s->>''marketing_url'' end,
    location_type=coalesce(s #>> ''{date_location,location,type}'',e.location_type::text,''in_person'')::public.event_location_type,
    location_building=case when s #>> ''{date_location,audience}''=''going'' then s #>> ''{date_location,location,public_summary}'' when s #>> ''{date_location,location,type}''=''online'' then ''Online'' else coalesce(s #>> ''{date_location,location,building}'',nullif(s->>''location_building'','''')) end,
    location_room=case when s #>> ''{date_location,audience}''=''going'' or s #>> ''{date_location,location,type}''=''online'' then null else coalesce(s #>> ''{date_location,location,room}'',nullif(s->>''location_room'','''')) end,
    location_address=case when s #>> ''{date_location,audience}''=''going'' or s #>> ''{date_location,location,type}''=''online'' then null else s #>> ''{date_location,location,address}'' end,
    location_address_url=case when s #>> ''{date_location,audience}''=''going'' or s #>> ''{date_location,location,type}''=''online'' then null else coalesce(s #>> ''{date_location,location,map_url}'',nullif(s->>''location_address_url'','''')) end,
    name=coalesce(s->>''name'',''''),description=');
 execute definition;
end $$;

-- Earlier expand steps deliberately retained original settings while installing
-- the compatible wrappers. Reconcile pending rows after all guards are present,
-- retaining document revisions and original fields/sections. The temporary marker
-- stays inside this transaction and only forces the shared save projection.
do $$ declare e public.events; result jsonb; begin
 for e in select * from public.events where working_document is not null order by id for update loop
   update public.events set working_document=working_document||jsonb_build_object('_unified_projection_reconcile',gen_random_uuid()) where id=e.id;
   result:=public.save_event_working_document(e.id,e.id,e.working_document,e.working_revision);
   update public.events set working_revision=e.working_revision where id=e.id;
   update public.admin_event_drafts d set revision=saved.working_revision,event_revision=saved.revision,document=saved.working_document
     from public.events saved where saved.id=e.id and d.event_id=e.id and not d.materialized;
 end loop;
end $$;
