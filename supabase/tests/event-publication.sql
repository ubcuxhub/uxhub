-- Included by rls.sql inside its rollback-only fixture transaction.
-- Check scheduler lifecycle, retry behavior, and restricted management access.
create function pg_temp.assert_publication_jobs()
returns void language plpgsql as $$
declare
  next_at timestamptz;
  next_local timestamp;
  expected_schedule text;
begin
  select min(publish_at) into next_at from public.events
    where status = 'draft' and publish_at is not null;
  if next_at is null then
    if exists (select 1 from cron.job where jobname in ('publish-due-events', 'recover-event-publication')) then
      raise exception 'publication jobs remain without scheduled drafts';
    end if;
    return;
  end if;
  next_at := greatest(
    date_trunc('minute', next_at) + case when next_at = date_trunc('minute', next_at)
      then interval '0' else interval '1 minute' end,
    date_trunc('minute', clock_timestamp()) + interval '1 minute');
  next_local := next_at at time zone coalesce(current_setting('cron.timezone', true), 'GMT');
  expected_schedule := format('%s %s %s %s *', extract(minute from next_local)::integer,
    extract(hour from next_local)::integer, extract(day from next_local)::integer,
    extract(month from next_local)::integer);
  if not exists (select 1 from cron.job where jobname = 'publish-due-events'
    and active and schedule = expected_schedule and command = 'select public.publish_due_events()') then
    raise exception 'publication job does not match the earliest pending date';
  end if;
  if not exists (select 1 from cron.job where jobname = 'recover-event-publication'
    and active and schedule = '17 * * * *') then
    raise exception 'pending schedules lack a recovery job';
  end if;
end;
$$;

select pg_temp.assert_publication_jobs();
update public.events set status = 'draft', publish_at = date_trunc('minute', now()) + interval '2 days'
where id = :'event_id';
select pg_temp.assert_publication_jobs();
-- Moving it earlier and later recalculates the wake-up, including seconds.
update public.events set publish_at = date_trunc('minute', now()) + interval '1 day 13 seconds'
where id = :'event_id';
select pg_temp.assert_publication_jobs();
update public.events set publish_at = date_trunc('minute', now()) + interval '3 days'
where id = :'event_id';
select pg_temp.assert_publication_jobs();

-- A second event can become the earliest; deleting it restores the first.
insert into public.events (name, description, regular_price, member_price, max_capacity, slug, status, publish_at)
values ('RLS publication', 'Rollback fixture', 0, 0, 10, 'rls-publication-delete', 'draft',
  date_trunc('minute', now()) + interval '1 day')
returning id as publication_delete_id \gset
select pg_temp.assert_publication_jobs();
delete from public.events where id = :'publication_delete_id';
select pg_temp.assert_publication_jobs();
do $$
begin
  if exists (select 1 from event_publication.watchdog w
    where not exists (select 1 from public.events e where e.id = w.event_id)) then
    raise exception 'deleted event retains a watchdog';
  end if;
end;
$$;

-- Cancelling or manually changing status removes unnecessary jobs.
update public.events set publish_at = null where id = :'event_id';
select pg_temp.assert_publication_jobs();
do $$
begin
  if exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event') then
    raise exception 'cancelled schedule retains a watchdog';
  end if;
end;
$$;
update public.events set publish_at = now() + interval '2 days' where id = :'event_id';
update public.events set status = 'archived' where id = :'event_id';
select pg_temp.assert_publication_jobs();
do $$
begin
  if exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event') then
    raise exception 'manual status change retains a watchdog';
  end if;
end;
$$;

-- A failed publication must keep the draft/date and commit a minute retry.
create function pg_temp.fail_test_event_publication()
returns trigger language plpgsql as $$
begin
  if old.slug = 'rls-event' and new.status = 'active' then
    raise exception 'Intentional publication test failure';
  end if;
  return new;
end;
$$;
create trigger fail_test_event_publication before update on public.events
for each row execute function pg_temp.fail_test_event_publication();
update public.events set status = 'draft', publish_at = now() - interval '1 second'
where id = :'event_id';
do $$
begin
  if public.publish_due_events() <> -1 then
    raise exception 'publication failure did not report a retry';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-event' and status = 'draft' and publish_at is not null) then
    raise exception 'failed publication changed the event';
  end if;
  if not exists (select 1 from cron.job where jobname = 'publish-due-events' and schedule = '* * * * *') then
    raise exception 'failed publication has no minute retry';
  end if;
end;
$$;
drop trigger fail_test_event_publication on public.events;
select public.publish_due_events();
select pg_temp.assert_publication_jobs();

do $$
declare
  fn text;
  role_name text;
begin
  foreach fn in array array['reschedule_event_publication()', 'lock_event_publication_schedule()',
    'reschedule_event_publication_after_write()'] loop
    foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
      if has_function_privilege(role_name, 'public.' || fn, 'execute') then
        raise exception '% can execute scheduler management function %', role_name, fn;
      end if;
    end loop;
  end loop;
end;
$$;

-- Watchdog windows follow individual schedules, sharing one bounded job.
update public.events set status = 'draft', publish_at = now() + interval '1 day'
where id = :'event_id';
do $$
declare w event_publication.watchdog;
begin
  select w0.* into strict w from event_publication.watchdog w0
    join public.events e on e.id = w0.event_id where e.slug = 'rls-event';
  if w.attempts <> 0 or w.next_check_at <> w.expected_run_at + interval '5 minutes' then
    raise exception 'watchdog is not armed after the publication grace period';
  end if;
  if not exists (select 1 from cron.job where jobname = 'check-event-publication' and active) then
    raise exception 'scheduled publication lacks a watchdog job';
  end if;
end;
$$;

-- Make checks due directly rather than waiting for wall-clock cron ticks.
-- Isolate credentials in this rollback-only transaction: tests never send HTTP.
delete from vault.secrets where name in ('event_publication_health_url', 'event_publication_health_secret');
update event_publication.watchdog set next_check_at = clock_timestamp() - interval '1 second'
where event_id = :'event_id';
select event_publication.check_publication();
update public.events set publish_at = publish_at where id = :'event_id';
do $$
begin
  if not exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event' and attempts = 1 and last_delivery_status = 'configuration_missing'
      and next_check_at > clock_timestamp() and cardinality(request_ids) = 0) then
    raise exception 'watchdog did not bound a configuration failure or reset on an unrelated write';
  end if;
end;
$$;
update event_publication.watchdog set next_check_at = clock_timestamp() - interval '1 second'
where event_id = :'event_id';
select event_publication.check_publication();
update event_publication.watchdog set next_check_at = clock_timestamp() - interval '1 second'
where event_id = :'event_id';
select event_publication.check_publication();
update public.events set publish_at = publish_at where id = :'event_id';
select event_publication.check_publication();
do $$
begin
  if not exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event' and attempts = 3 and next_check_at is null) then
    raise exception 'watchdog did not stop after three checks';
  end if;
  if has_schema_privilege('anon', 'event_publication', 'usage')
    or has_schema_privilege('authenticated', 'event_publication', 'usage')
    or has_schema_privilege('service_role', 'event_publication', 'usage')
    or has_table_privilege('anon', 'event_publication.watchdog', 'select')
    or has_function_privilege('authenticated', 'event_publication.check_publication()', 'execute') then
    raise exception 'watchdog state or management is accessible to application roles';
  end if;
end;
$$;

-- Real pg_net enqueues requests only after commit. These rollback-only tests
-- inspect signed headers and inject responses without sending any HTTP.
select vault.create_secret('https://publication-test.invalid/api/internal/event-publication', 'event_publication_health_url');
select vault.create_secret('rollback-test-secret', 'event_publication_health_secret');
update public.events set publish_at = now() + interval '3 days' where id = :'event_id';
update event_publication.watchdog set next_check_at = clock_timestamp() - interval '1 second'
where event_id = :'event_id';
select event_publication.check_publication();
do $$
declare
  request net.http_request_queue;
  w event_publication.watchdog;
  signed_at text;
begin
  select w0.* into strict w from event_publication.watchdog w0 join public.events e
    on e.id = w0.event_id where e.slug = 'rls-event';
  select * into strict request from net.http_request_queue where id = w.request_ids[1];
  signed_at := request.headers ->> 'x-publication-timestamp';
  if w.attempts <> 1 or w.last_delivery_status <> 'queued' or signed_at is null
    or request.headers ->> 'x-publication-signature' is distinct from
      encode(extensions.hmac('event-publication:' || signed_at, 'rollback-test-secret', 'sha256'), 'hex')
    or request.headers::text like '%rollback-test-secret%' then
    raise exception 'watchdog request is unsigned or exposes its shared secret';
  end if;
end;
$$;
insert into net._http_response (id, status_code, timed_out)
select w.request_ids[1], 503, false from event_publication.watchdog w
where event_id = :'event_id';
update event_publication.watchdog set next_check_at = clock_timestamp() - interval '1 second'
where event_id = :'event_id';
select event_publication.check_publication();
do $$
begin
  if not exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event' and attempts = 2 and last_response_status = 'http_503'
      and cardinality(request_ids) = 2) then
    raise exception 'watchdog did not observe failed HTTP delivery or retry it';
  end if;
end;
$$;
insert into net._http_response (id, timed_out)
select w.request_ids[2], true from event_publication.watchdog w where event_id = :'event_id';
update event_publication.watchdog set next_check_at = clock_timestamp() - interval '1 second'
where event_id = :'event_id';
select event_publication.check_publication();
do $$
begin
  if not exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event' and attempts = 3 and next_check_at is null
      and last_response_status = 'timeout' and cardinality(request_ids) = 3) then
    raise exception 'watchdog did not bound HTTP timeouts';
  end if;
end;
$$;

-- A deliberate schedule change gets a fresh budget; cancellation cleans it up.
update public.events set publish_at = now() + interval '2 days' where id = :'event_id';
do $$
begin
  if not exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event' and attempts = 0 and next_check_at is not null) then
    raise exception 'edited schedule has no fresh watchdog window';
  end if;
end;
$$;
update public.events set publish_at = now() - interval '1 second' where id = :'event_id';
create trigger fail_test_event_publication before update on public.events
for each row execute function pg_temp.fail_test_event_publication();
update event_publication.watchdog set next_check_at = clock_timestamp() - interval '1 second'
where event_id = :'event_id';
select event_publication.check_publication();
do $$
begin
  if public.publish_due_events() <> -1 then
    raise exception 'expected intentional publication failure';
  end if;
  if not exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event' and attempts = 1) then
    raise exception 'failed publisher restarted the watchdog budget';
  end if;
end;
$$;
drop trigger fail_test_event_publication on public.events;
select public.publish_due_events();
do $$
begin
  if exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event') then
    raise exception 'successful publication retains a watchdog';
  end if;
  if not exists (select 1 from event_publication.watchdog where next_check_at is not null)
    and exists (select 1 from cron.job where jobname = 'check-event-publication') then
    raise exception 'watchdog job remains with no checks pending';
  end if;
end;
$$;

-- Exercise the actual upgrade SQL against legacy rows. Remove only the new
-- guard/constraint within this rollback-only transaction to recreate old data.
drop trigger guard_event_publish_schedule on public.events;
drop function public.guard_event_publish_schedule();
alter table public.events drop constraint events_publish_schedule_requires_draft;
drop index public.events_pending_publication_idx;
drop function public.publish_due_events();
insert into public.events (name, description, regular_price, member_price, max_capacity, slug, status, publish_at)
values
 ('Legacy scheduled', 'Rollback fixture', 0, 0, 10, 'rls-legacy-scheduled', 'active', now() + interval '2 days'),
 ('Legacy published', 'Rollback fixture', 0, 0, 10, 'rls-legacy-published', 'active', now() - interval '2 days'),
 ('Legacy archived', 'Rollback fixture', 0, 0, 10, 'rls-legacy-archived', 'archived', now() + interval '2 days'),
 ('Legacy draft', 'Rollback fixture', 0, 0, 10, 'rls-legacy-draft', 'draft', now() + interval '2 days');
\ir ../migrations/20261027230346_activate_scheduled_drafts.sql

do $$
begin
  if not exists (select 1 from public.events where slug = 'rls-legacy-scheduled'
    and status = 'draft' and publish_at = now() + interval '2 days') then
    raise exception 'migration lost the legacy scheduled publication';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-legacy-published'
    and status = 'active' and publish_at is null) then
    raise exception 'migration changed an already published event';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-legacy-archived'
    and status = 'archived' and publish_at is null) then
    raise exception 'migration retained an archived schedule';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-legacy-draft'
    and status = 'draft' and publish_at = now() + interval '2 days') then
    raise exception 'migration lost a draft schedule';
  end if;
end;
$$;
