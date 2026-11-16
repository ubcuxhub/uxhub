-- Re-run the actual expand backfill against legacy-shaped fixtures. Everything,
-- including changes to existing local rows, rolls back. Never targets production.
-- Run from the repository root, against a database that has the migration:
--   psql "${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:15432/postgres}" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/unified-draft-migration.sql
\set ON_ERROR_STOP on
-- The backfill block is read from the migration itself, so this script always
-- exercises the code that ships.
\set backfill `sed -n '/^-- 10\. Backfill/,/^end \$\$;$/p' supabase/migrations/20261115024039_unify_event_draft_lifecycle.sql`
begin;
select set_config('uxhub.unified_backfill', :'backfill', true) is not null as backfill_loaded;
do $check$ begin
  if current_setting('uxhub.unified_backfill') not like '%save_event_working_document(d.id,d.event_id,doc,0)%end $$;' then
    raise exception 'Could not read the backfill block from the migration';
  end if;
end $check$;
insert into public.events(id,name,slug,status,description,regular_price,member_price,max_capacity)
values ('a1000000-0000-4000-8000-000000000002','Attached original','migration-attached-original','draft','Old',10,0,20),
('a1000000-0000-4000-8000-000000000003','Materialized','migration-materialized','draft',null,null,null,null);
-- The attached document includes pricing_mode: it postdates configuration and
-- owns its saved URL. Pre-configuration documents inherit their event settings.
insert into public.admin_event_drafts(id,event_id,document,revision,materialized) values
('a1000000-0000-4000-8000-000000000001',null,'{"version":1,"formState":{"name":"Standalone","slug_edited":true,"page_slug":"migration-standalone","header_image_url":"https://example.test/header.png"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',7,false),
('a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002','{"version":1,"formState":{"name":"Attached saved","pricing_mode":"legacy","slug_edited":true,"page_slug":"migration-attached-saved","description":"Exact saved description"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',3,false),
('a1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000003','{"version":1,"formState":{}}',2,true);

-- Locked settings. Before #269 staff could register for unscheduled drafts, so
-- a pending legacy document can disagree with a setting its event has since
-- locked. Each event below is an unscheduled draft (legacy pricing 10/0,
-- capacity 20) whose document also carries an unrelated edit to preserve.
insert into public.user_info(id,email,first_name,last_name,role_access) values
('a1000000-0000-4000-8000-000000000101','migration-lock-1@example.test','Lock','One','basic'),
('a1000000-0000-4000-8000-000000000102','migration-lock-2@example.test','Lock','Two','basic');
insert into public.events(id,name,slug,status,description,regular_price,member_price,max_capacity,requires_application,teams_enabled,min_team_size,max_team_size)
values
-- A ticket locks pricing (the production failure).
('a1000000-0000-4000-8000-000000000011','Lock pricing','migration-lock-pricing','draft','Old',10,0,20,false,false,null,null),
-- Two tickets lock pricing, registration mode and a capacity floor of 2.
('a1000000-0000-4000-8000-000000000012','Lock combined','migration-lock-combined','draft','Old',10,0,20,false,false,null,null),
-- A submitted application locks registration mode but not pricing.
('a1000000-0000-4000-8000-000000000013','Lock application','migration-lock-application','draft','Old',10,0,20,true,false,null,null),
-- A two-person team locks teams on and a maximum size of at least 2.
('a1000000-0000-4000-8000-000000000014','Lock teams','migration-lock-teams','draft','Old',10,0,20,false,true,1,4);
insert into public.event_tickets(event_id,user_id) values
('a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000101'),
('a1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000101'),
('a1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000102'),
('a1000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000101'),
('a1000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000102');
insert into public.event_applications(event_id,user_id,status) values
('a1000000-0000-4000-8000-000000000013','a1000000-0000-4000-8000-000000000101','submitted');
insert into public.teams(id,event_id,owner_id) values
('a1000000-0000-4000-8000-000000000201','a1000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000101');
insert into public.team_members(event_id,team_id,user_id) values
('a1000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000201','a1000000-0000-4000-8000-000000000101'),
('a1000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000201','a1000000-0000-4000-8000-000000000102');
-- A once-published event returned to draft keeps its locked URL.
insert into public.events(id,name,slug,status,short_description,description,starts_at,ends_at,regular_price,member_price,max_capacity)
values ('a1000000-0000-4000-8000-000000000015','Lock URL','migration-lock-url','active','Short','Old',now()+interval '30 days',now()+interval '31 days',10,0,20);
insert into public.events(id,name,slug,status,short_description,description,starts_at,ends_at,regular_price,member_price,max_capacity)
values ('a1000000-0000-4000-8000-000000000016','Lock URL invalid','migration-lock-url-invalid','active','Short','Old',now()+interval '30 days',now()+interval '31 days',10,0,20);
update public.events set status='draft' where id in ('a1000000-0000-4000-8000-000000000015','a1000000-0000-4000-8000-000000000016');
insert into public.admin_event_drafts(id,event_id,document,revision,materialized) values
('a1000000-0000-4000-8000-000000000021','a1000000-0000-4000-8000-000000000011','{"version":1,"formState":{"name":"Lock pricing saved","pricing_mode":"paid","pricing_amount":"25","regular_price":"25","member_price":"5","max_capacity":"20","slug_edited":true,"page_slug":"migration-lock-pricing","description":"Kept pricing edit"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',4,false),
('a1000000-0000-4000-8000-000000000022','a1000000-0000-4000-8000-000000000012','{"version":1,"formState":{"name":"Lock combined saved","pricing_mode":"free","pricing_amount":"0","requires_application":true,"max_capacity":"1","slug_edited":true,"page_slug":"migration-lock-combined","description":"Kept combined edit"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',5,false),
('a1000000-0000-4000-8000-000000000023','a1000000-0000-4000-8000-000000000013','{"version":1,"formState":{"name":"Lock application saved","pricing_mode":"paid","pricing_amount":"15","requires_application":false,"max_capacity":"20","slug_edited":true,"page_slug":"migration-lock-application","description":"Kept application edit"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',6,false),
('a1000000-0000-4000-8000-000000000024','a1000000-0000-4000-8000-000000000014','{"version":1,"formState":{"name":"Lock teams saved","pricing_mode":"legacy","regular_price":"10","member_price":"0","max_capacity":"20","teams_enabled":false,"min_team_size":"","max_team_size":"1","slug_edited":true,"page_slug":"migration-lock-teams","description":"Kept teams edit"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',7,false),
('a1000000-0000-4000-8000-000000000025','a1000000-0000-4000-8000-000000000015','{"version":1,"formState":{"name":"Lock URL saved","pricing_mode":"legacy","regular_price":"10","member_price":"0","max_capacity":"20","slug_edited":true,"page_slug":"migration-lock-url-renamed","description":"Kept URL edit"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',8,false),
('a1000000-0000-4000-8000-000000000026','a1000000-0000-4000-8000-000000000016','{"version":1,"formState":{"name":"Lock URL invalid saved","pricing_mode":"legacy","regular_price":"10","member_price":"0","max_capacity":"20","slug_edited":true,"page_slug":"Not a URL","description":"Kept invalid URL edit"},"checkInEvents":[],"applicationTemplate":[],"mentors":[],"sponsors":[]}',9,false);

do $$ begin execute current_setting('uxhub.unified_backfill'); end $$;

do $$ begin
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000001' and working_revision=7 and slug='migration-standalone' and header_image_url='https://example.test/header.png' and max_capacity is null and regular_price is null) then raise exception 'Standalone identity/document preservation failed'; end if;
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000002' and working_revision=3 and slug='migration-attached-saved' and working_document #>> '{formState,description}'='Exact saved description' and 'a1000000-0000-4000-8000-000000000004'=any(legacy_draft_ids)) then raise exception 'Attached identity/document preservation failed'; end if;
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000003' and working_document is null and 'a1000000-0000-4000-8000-000000000005'=any(legacy_draft_ids)) then raise exception 'Materialized alias preservation failed'; end if;
 if exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000004') then raise exception 'Attached event was duplicated'; end if;

 -- Pricing: the event keeps its locked price; the document says so; the
 -- unrelated edits are saved.
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000011'
   and regular_price=10 and member_price=0 and configured_pricing_mode is null and configured_price is null
   and name='Lock pricing saved' and description='Kept pricing edit' and working_revision=4
   and working_document #>> '{formState,pricing_mode}'='legacy' and working_document #>> '{formState,pricing_amount}'='10'
   and working_document #>> '{formState,regular_price}'='10' and working_document #>> '{formState,member_price}'='0'
   and working_document #>> '{formState,description}'='Kept pricing edit'
   and 'a1000000-0000-4000-8000-000000000021'=any(legacy_draft_ids)) then raise exception 'Locked pricing was not reconciled'; end if;
 if not exists(select 1 from public.admin_event_drafts d join public.events e on e.id=d.event_id where d.id='a1000000-0000-4000-8000-000000000021'
   and not d.materialized and d.document=e.working_document) then raise exception 'Reconciled pricing document was not mirrored'; end if;

 -- Several locks on one event are each reset in turn.
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000012'
   and regular_price=10 and member_price=0 and configured_pricing_mode is null and not requires_application and max_capacity=20
   and name='Lock combined saved' and description='Kept combined edit' and working_revision=5
   and working_document #>> '{formState,pricing_mode}'='legacy' and working_document #>> '{formState,requires_application}'='false'
   and working_document #>> '{formState,max_capacity}'='20' and working_document #>> '{formState,description}'='Kept combined edit')
   then raise exception 'Combined locked settings were not reconciled'; end if;

 -- Only the setting that is locked is reset: a submitted application locks
 -- registration mode, while the pending price change still applies.
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000013'
   and requires_application and configured_pricing_mode='paid' and configured_price=15 and regular_price=15
   and description='Kept application edit' and working_revision=6
   and working_document #>> '{formState,requires_application}'='true' and working_document #>> '{formState,pricing_amount}'='15')
   then raise exception 'Registration mode lock was not reconciled narrowly'; end if;

 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000014'
   and teams_enabled and max_team_size=4 and min_team_size is null and description='Kept teams edit' and working_revision=7
   and working_document #>> '{formState,teams_enabled}'='true' and working_document #>> '{formState,max_team_size}'='4')
   then raise exception 'Team locks were not reconciled'; end if;

 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000015'
   and slug='migration-lock-url' and first_published_at is not null and name='Lock URL saved' and description='Kept URL edit'
   and working_revision=8 and working_document #>> '{formState,page_slug}'='migration-lock-url')
   then raise exception 'Published URL lock was not reconciled'; end if;
 if not exists(select 1 from public.events where id='a1000000-0000-4000-8000-000000000016'
   and slug='migration-lock-url-invalid' and description='Kept invalid URL edit' and working_revision=9
   and working_document #>> '{formState,page_slug}'='migration-lock-url-invalid')
   then raise exception 'Invalid URL on a published event was not reconciled'; end if;
end $$;

-- The runtime locks still reject ordinary saves after the backfill.
do $$ declare e public.events; begin
 select * into e from public.events where id='a1000000-0000-4000-8000-000000000011';
 begin
   perform public.save_event_working_document(e.id,e.id,jsonb_set(e.working_document,'{formState}',
     (e.working_document->'formState')||'{"pricing_mode":"paid","pricing_amount":"30"}'),e.working_revision);
   raise exception 'Expected the pricing lock to reject a normal save';
 exception when others then
   if sqlerrm <> 'Pricing is locked because registrations or payments exist.' then raise; end if;
 end;
 select * into e from public.events where id='a1000000-0000-4000-8000-000000000012';
 begin
   perform public.save_event_working_document(e.id,e.id,jsonb_set(e.working_document,'{formState,requires_application}','true'),e.working_revision);
   raise exception 'Expected the registration mode lock to reject a normal save';
 exception when others then
   if sqlerrm <> 'Registration mode is locked because registrations or payments exist.' then raise; end if;
 end;
 select * into e from public.events where id='a1000000-0000-4000-8000-000000000012';
 begin
   perform public.save_event_working_document(e.id,e.id,jsonb_set(e.working_document,'{formState,max_capacity}','"1"'),e.working_revision);
   raise exception 'Expected the capacity floor to reject a normal save';
 exception when others then
   if sqlerrm not like 'Capacity cannot be below 2 committed seats%' then raise; end if;
 end;
end $$;

insert into public.admin_event_drafts(id,document) values ('a1000000-0000-4000-8000-000000000006','{"version":1,"formState":{"name":"Collision","slug_edited":true,"page_slug":"migration-standalone"}}');
do $verify$ begin
 begin
   execute current_setting('uxhub.unified_backfill');
   raise exception 'Expected collision to block cutover';
 exception when others then
   if sqlerrm not like '%a1000000-0000-4000-8000-000000000006%already in use%' then raise; end if;
 end;
 if not exists(select 1 from public.admin_event_drafts where id='a1000000-0000-4000-8000-000000000006' and event_id is null and document #>> '{formState,page_slug}'='migration-standalone') then raise exception 'Collision discarded saved document'; end if;
end $verify$;
rollback;
select 'Unified migration preservation, locked settings and collision rollback passed' as result;
