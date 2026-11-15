-- Match the application's pinned Pacific calendar, including permanent UTC-7
-- from March 2026, even when the local PostgreSQL tzdata is older.
create or replace function public.draft_event_timestamp(value text) returns timestamptz
language plpgsql set search_path = '' as $$
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then return null; end if;
 if value::timestamp >= timestamp '2026-03-08 03:00:00' then
   return value::timestamp at time zone 'Etc/GMT+7';
 end if;
 return value::timestamp at time zone 'America/Vancouver';
exception when others then return null;
end $$;
create function public.draft_event_wall_time(value timestamptz) returns timestamp
language sql immutable set search_path = '' as $$
 select value at time zone (case when value >= timestamptz '2026-03-08 10:00:00Z' then 'Etc/GMT+7' else 'America/Vancouver' end)
$$;
revoke all on function public.draft_event_wall_time(timestamptz) from public,anon,authenticated;

do $$ declare definition text; begin
 select pg_get_functiondef('public.delete_admin_event_safely(uuid,uuid)'::regprocedure) into definition;
 definition:=replace(definition, 'lateral jsonb_path_query(working_document,', 'lateral jsonb_path_query(working_document,');
 definition:=replace(definition, 'union select value #>> ''{}''', 'union select jsonb_path_query #>> ''{}''');
 execute definition;
 select pg_get_functiondef('public.update_admin_event_schedule(uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition, '(p_patch->>field)::timestamptz at time zone ''America/Vancouver''', 'public.draft_event_wall_time((p_patch->>field)::timestamptz)');
 definition:=replace(definition, '(p_patch->>''starts_at'')::timestamptz at time zone ''America/Vancouver''', 'public.draft_event_wall_time((p_patch->>''starts_at'')::timestamptz)');
 definition:=replace(definition, '(p_patch->>''ends_at'')::timestamptz at time zone ''America/Vancouver''', 'public.draft_event_wall_time((p_patch->>''ends_at'')::timestamptz)');
 definition:=replace(definition, 'where id=p_event_id returning *;',
   'where id=p_event_id returning *;
    update public.admin_event_drafts d set document=saved.working_document,revision=saved.working_revision,event_revision=saved.revision,updated_at=now()
    from public.events saved where saved.id=p_event_id and d.event_id=saved.id and not d.materialized and saved.working_document is not null;');
 execute definition;
 select pg_get_functiondef('public.guard_event_publication_readiness()'::regprocedure) into definition;
 definition:=replace(definition, 'if btrim(new.name)='''' or',
   'if length(new.short_description)>50 or length(new.description)>3000 or btrim(new.name)='''' or');
 execute definition;
end $$;

alter table public.events drop constraint events_max_capacity_check;
alter table public.events add constraint events_max_capacity_check check(max_capacity >= 0);

-- Child writes finish after the event row in the established materializer.
-- Validate application completeness at commit for publication transitions,
-- including quick edits and the scheduler. Trusted service-role fixture/legacy
-- inserts retain their established maintenance capability.
create function public.guard_event_publication_questions() returns trigger
language plpgsql set search_path = '' as $$
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
end $$;
create constraint trigger event_publication_questions after insert or update on public.events
 deferrable initially deferred for each row execute function public.guard_event_publication_questions();
revoke all on function public.guard_event_publication_questions() from public,anon,authenticated;
