-- Re-run the actual expand backfill against legacy-shaped fixtures. Everything,
-- including changes to existing local rows, rolls back. Never targets production.
\set ON_ERROR_STOP on
begin;
insert into public.events(id,name,slug,status,description,regular_price,member_price,max_capacity)
values ('a1000000-0000-4000-8000-000000000002','Attached original','migration-attached-original','draft','Old',10,0,20),
('a1000000-0000-4000-8000-000000000003','Materialized','migration-materialized','draft',null,null,null,null);
-- The attached document includes pricing_mode: it postdates configuration and
-- owns its saved URL. Pre-configuration documents inherit their event settings.
insert into public.admin_event_drafts(id,event_id,document,revision,materialized) values
('a1000000-0000-4000-8000-000000000001',null,'{"version":1,"formState":{"name":"Standalone","slug_edited":true,"page_slug":"migration-standalone","header_image_url":"https://example.test/header.png"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',7,false),
('a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002','{"version":1,"formState":{"name":"Attached saved","pricing_mode":"legacy","slug_edited":true,"page_slug":"migration-attached-saved","description":"Exact saved description"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',3,false),
('a1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000003','{"version":1,"formState":{}}',2,true);
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
do $$ begin
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000001' and working_revision=7 and slug='migration-standalone' and header_image_url='https://example.test/header.png' and max_capacity is null and regular_price is null) then raise exception 'Standalone identity/document preservation failed'; end if;
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000002' and working_revision=3 and slug='migration-attached-saved' and working_document #>> '{formState,description}'='Exact saved description' and 'a1000000-0000-4000-8000-000000000004'=any(legacy_draft_ids)) then raise exception 'Attached identity/document preservation failed'; end if;
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000003' and working_document is null and 'a1000000-0000-4000-8000-000000000005'=any(legacy_draft_ids)) then raise exception 'Materialized alias preservation failed'; end if;
 if exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000004') then raise exception 'Attached event was duplicated'; end if;
end $$;
insert into public.admin_event_drafts(id,document) values ('a1000000-0000-4000-8000-000000000006','{"version":1,"formState":{"name":"Collision","slug_edited":true,"page_slug":"migration-standalone"}}');
do $verify$ begin
 begin
execute $backfill$do $$ declare d public.admin_event_drafts; e public.events; r jsonb; begin
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
end $$;$backfill$;

 raise exception 'Expected collision to block cutover';
 exception when others then
   if sqlerrm not like '%a1000000-0000-4000-8000-000000000006%already in use%' then raise; end if;
 end;
 if not exists(select 1 from public.admin_event_drafts where id='a1000000-0000-4000-8000-000000000006' and event_id is null and document #>> '{formState,page_slug}'='migration-standalone') then raise exception 'Collision discarded saved document'; end if;
end $verify$;
rollback;
select 'Unified migration preservation and collision rollback passed' as result;
