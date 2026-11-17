-- Included by rls.sql inside its rollback-only fixture transaction.
-- Check scheduler lifecycle, retry behavior, and restricted management access.
-- A draft blocked at its current publish date waits for the hourly recovery
-- run, so it never sets the minute job; the recovery job stays while any
-- schedule exists.
create function pg_temp.assert_publication_jobs()
returns void language plpgsql as $$
declare
  next_at timestamptz;
  next_local timestamp;
  expected_schedule text;
begin
  if not exists (select 1 from public.events where status = 'draft' and publish_at is not null) then
    if exists (select 1 from cron.job where jobname in ('publish-due-events', 'recover-event-publication')) then
      raise exception 'publication jobs remain without scheduled drafts';
    end if;
    return;
  end if;
  if not exists (select 1 from cron.job where jobname = 'recover-event-publication'
    and active and schedule = '17 * * * *') then
    raise exception 'pending schedules lack a recovery job';
  end if;
  select min(e.publish_at) into next_at from public.events e
    where e.status = 'draft' and e.publish_at is not null
      and not exists (select 1 from event_publication.blocked b
        where b.event_id = e.id and b.publish_at = e.publish_at);
  if next_at is null then
    if exists (select 1 from cron.job where jobname = 'publish-due-events') then
      raise exception 'blocked drafts alone keep a minute publication job';
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
insert into public.events (short_description, starts_at, ends_at, name, description, regular_price, member_price, max_capacity, slug, status, publish_at)
values ('Publication fixture', now()+interval '5 days', now()+interval '6 days', 'RLS publication', 'Rollback fixture', 0, 0, 10, 'rls-publication-delete', 'draft',
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
update public.events set status = 'active' where id = :'event_id';
select pg_temp.assert_publication_jobs();
do $$
begin
  if exists (select 1 from event_publication.watchdog w join public.events e on e.id = w.event_id
    where e.slug = 'rls-event') then
    raise exception 'manual status change retains a watchdog';
  end if;
end;
$$;

-- One draft's lasting failure must not hold back another due draft. The
-- failure keeps its draft and date, is recorded as blocked, and gets no minute
-- retry: the hourly recovery run tries it again.
-- rls.publication_failure picks the SQLSTATE the forced failure raises.
create function pg_temp.fail_test_event_publication()
returns trigger language plpgsql as $$
begin
  if old.slug = 'rls-event' and new.status = 'active' then
    raise exception 'Intentional publication test failure'
      using errcode = coalesce(nullif(current_setting('rls.publication_failure', true), ''), 'P0001');
  end if;
  return new;
end;
$$;
create trigger fail_test_event_publication before update on public.events
for each row execute function pg_temp.fail_test_event_publication();
update public.events set status = 'draft', publish_at = now() - interval '1 second'
where id = :'event_id';
insert into public.events (short_description, starts_at, ends_at, name, description, regular_price, member_price, max_capacity, slug, status, publish_at)
values ('Publication fixture', now()+interval '5 days', now()+interval '6 days', 'RLS publication sibling', 'Rollback fixture', 0, 0, 10, 'rls-publication-sibling', 'draft',
  now() - interval '2 seconds');
do $$
declare
  b event_publication.blocked;
begin
  if public.publish_due_events() < 1 then
    raise exception 'a failing draft held back the publication run';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-publication-sibling' and status = 'active' and publish_at is null) then
    raise exception 'a failing draft held back a due sibling';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-event' and status = 'draft' and publish_at is not null) then
    raise exception 'failed publication changed the event';
  end if;
  select b0.* into b from event_publication.blocked b0 join public.events e
    on e.id = b0.event_id and e.publish_at = b0.publish_at where e.slug = 'rls-event';
  if b.reason is distinct from 'P0001' or b.failures <> 1 or b.first_failed_at <> b.last_failed_at then
    raise exception 'failed draft was not recorded as blocked by its SQLSTATE';
  end if;
  if exists (select 1 from cron.job where jobname = 'publish-due-events' and schedule = '* * * * *') then
    raise exception 'a blocked draft kept a minute retry';
  end if;
  -- A later run (the hourly recovery) retries it and counts the failure.
  perform public.publish_due_events();
  if not exists (select 1 from event_publication.blocked b0 join public.events e on e.id = b0.event_id
    where e.slug = 'rls-event' and b0.failures = 2 and b0.first_failed_at = b.first_failed_at
      and b0.last_failed_at > b.last_failed_at) then
    raise exception 'a repeated failure was not counted against the same block';
  end if;
end;
$$;
-- No minute job is set for the blocked draft; the recovery job remains.
select pg_temp.assert_publication_jobs();

-- The watchdog endpoint reads blocked drafts; application roles cannot.
do $$
declare
  health record;
begin
  select * into strict health from public.event_publication_health(clock_timestamp());
  if health.blocked_count < 1 or health.overdue_count < health.blocked_count
    or not (select e.id from public.events e where e.slug = 'rls-event') = any(health.blocked_event_ids) then
    raise exception 'publication health omits a blocked draft';
  end if;
  if not has_function_privilege('service_role', 'public.event_publication_health(timestamptz)', 'execute')
    or has_function_privilege('anon', 'public.event_publication_health(timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'public.event_publication_health(timestamptz)', 'execute') then
    raise exception 'publication health is not limited to the service role';
  end if;
  if has_table_privilege('anon', 'event_publication.blocked', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'event_publication.blocked', 'select,insert,update,delete')
    or has_table_privilege('service_role', 'event_publication.blocked', 'select,insert,update,delete') then
    raise exception 'blocked publication state is accessible to application roles';
  end if;
end;
$$;

-- Changing the publish date clears the block. A transient failure (here a
-- lock timeout) does not block: the draft keeps the minute retry.
update public.events set publish_at = now() - interval '3 seconds' where id = :'event_id';
select set_config('rls.publication_failure', '55P03', true);
do $$
begin
  if exists (select 1 from event_publication.blocked b join public.events e on e.id = b.event_id
    where e.slug = 'rls-event') then
    raise exception 'a new publish date kept the old block';
  end if;
  if public.publish_due_events() < 0 then
    raise exception 'a transient draft failure failed the whole run';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-event' and status = 'draft' and publish_at is not null) then
    raise exception 'transient failure changed the event';
  end if;
  if exists (select 1 from event_publication.blocked b join public.events e on e.id = b.event_id
    where e.slug = 'rls-event') then
    raise exception 'a transient failure blocked the draft';
  end if;
end;
$$;
-- The due, unblocked draft sets the publication job to the next minute.
select pg_temp.assert_publication_jobs();
-- A statement timeout (query_canceled, which OTHERS does not catch) on one
-- draft is transient too.
select set_config('rls.publication_failure', '57014', true);
do $$
begin
  if public.publish_due_events() < 0 or exists (select 1 from event_publication.blocked b
    join public.events e on e.id = b.event_id where e.slug = 'rls-event')
    or not exists (select 1 from public.events where slug = 'rls-event' and status = 'draft') then
    raise exception 'a statement timeout was not treated as transient';
  end if;
end;
$$;
select pg_temp.assert_publication_jobs();
select set_config('rls.publication_failure', '', true);
drop trigger fail_test_event_publication on public.events;
select public.publish_due_events();
select pg_temp.assert_publication_jobs();

-- An application draft with no valid question fails the questions guard,
-- which is deferred to commit. The publisher checks it at the draft's own
-- update, so the failure is caught and recorded there, its sibling still
-- publishes, and nothing is left pending for commit. A trusted service-role
-- insert, which that guard exempts, stands in for questions removed before
-- the removal guard below existed.
select coalesce(current_setting('request.jwt.claims', true), '') as publication_saved_claims \gset
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.events (short_description, starts_at, ends_at, name, description, regular_price, member_price, max_capacity, slug, status, publish_at, requires_application)
values ('Publication fixture', now()+interval '5 days', now()+interval '6 days', 'RLS publication no questions', 'Rollback fixture', 0, 0, 10, 'rls-publication-no-questions', 'draft',
  now() - interval '1 second', true);
-- The deferred guard reads the role when it fires, so run it before the
-- claims change back, as a service-role request's commit would.
set constraints public.event_publication_questions immediate;
set constraints public.event_publication_questions deferred;
select set_config('request.jwt.claims', :'publication_saved_claims', true);
insert into public.events (short_description, starts_at, ends_at, name, description, regular_price, member_price, max_capacity, slug, status, publish_at)
values ('Publication fixture', now()+interval '5 days', now()+interval '6 days', 'RLS publication sibling 2', 'Rollback fixture', 0, 0, 10, 'rls-publication-sibling-2', 'draft',
  now() - interval '1 second');
do $$
begin
  if public.publish_due_events() < 1 then
    raise exception 'an unready application draft held back the publication run';
  end if;
  if not exists (select 1 from public.events where slug = 'rls-publication-sibling-2' and status = 'active') then
    raise exception 'an unready application draft held back a due sibling';
  end if;
  if not exists (select 1 from event_publication.blocked b join public.events e
    on e.id = b.event_id and e.publish_at = b.publish_at
    where e.slug = 'rls-publication-no-questions' and e.status = 'draft'
      and b.reason = 'EVENT_PUBLICATION_INVALID') then
    raise exception 'the deferred questions failure was not caught and recorded by its hint';
  end if;
end;
$$;
set constraints all immediate;
set constraints public.event_publication_questions, public.event_application_questions_publication deferred;
select pg_temp.assert_publication_jobs();

-- A SET CONSTRAINTS change made inside a subtransaction that rolls back is
-- undone with it, and one made before a subtransaction survives that
-- subtransaction's rollback. publish_due_events relies on both: a draft's
-- failed update leaves the guard immediate for the next draft, and a failed
-- run leaves it deferred.
do $$
declare
  raised boolean := false;
  hint text;
begin
  begin
    set constraints public.event_publication_questions immediate;
    raise exception using errcode = 'UXT01';
  exception when sqlstate 'UXT01' then null;
  end;
  begin
    -- Changing the date re-runs the guard, which this draft fails.
    update public.events set publish_at = publish_at + interval '1 second'
      where slug = 'rls-publication-no-questions';
    raise exception using errcode = 'UXT01';
  exception
    when sqlstate 'UXT01' then null;
    when others then
      raise exception 'a rolled-back SET CONSTRAINTS change outlived its subtransaction';
  end;

  set constraints public.event_publication_questions immediate;
  begin
    raise exception using errcode = 'UXT01';
  exception when sqlstate 'UXT01' then null;
  end;
  begin
    update public.events set publish_at = publish_at + interval '1 second'
      where slug = 'rls-publication-no-questions';
  exception when others then
    get stacked diagnostics hint = pg_exception_hint;
    raised := hint = 'EVENT_PUBLICATION_INVALID';
  end;
  set constraints public.event_publication_questions deferred;
  if not raised then
    raise exception 'an inner rollback undid the outer SET CONSTRAINTS change';
  end if;
end;
$$;

-- A failure outside any one draft reports -1, changes nothing and commits a
-- minute retry. Here the caller's own pending questions check fails as soon
-- as the publisher makes the guard immediate.
do $$
declare
  result integer;
begin
  begin
    update public.events set publish_at = publish_at + interval '1 second'
      where slug = 'rls-publication-no-questions';
    result := public.publish_due_events();
    if result <> -1 or not exists (select 1 from cron.job
      where jobname = 'publish-due-events' and schedule = '* * * * *') then
      raise exception 'a failed run did not report -1 with a minute retry';
    end if;
    raise exception using errcode = 'UXT01';
  exception when sqlstate 'UXT01' then null;
  end;
end;
$$;
select pg_temp.assert_publication_jobs();

-- Deleting or blanking the last question of a scheduled or active application
-- event is refused at commit. Replacing it, unscheduling the event first, or
-- deleting the event is allowed. Each change runs in a subtransaction that
-- rolls back.
insert into public.events (short_description, starts_at, ends_at, name, description, regular_price, member_price, max_capacity, slug, status, publish_at, requires_application)
values ('Publication fixture', now()+interval '5 days', now()+interval '6 days', 'RLS publication guarded', 'Rollback fixture', 0, 0, 10, 'rls-publication-guarded', 'draft',
  now() + interval '2 days', true)
returning id as publication_guarded_id \gset
insert into public.event_application_questions (event_id, question, response_type)
values (:'publication_guarded_id', 'Why?', 'long_text');
set constraints public.event_publication_questions immediate;
set constraints public.event_publication_questions deferred;
create function pg_temp.assert_question_change(statements text[], refused boolean)
returns void language plpgsql as $$
declare
  statement text;
  hint text;
begin
  begin
    foreach statement in array statements loop
      execute statement;
    end loop;
    set constraints public.event_application_questions_publication immediate;
    if refused then
      raise exception 'question change was allowed: %', statements;
    end if;
    raise exception using errcode = 'UXT01';
  exception
    when sqlstate 'UXT01' then null;
    when others then
      get stacked diagnostics hint = pg_exception_hint;
      if not refused or hint is distinct from 'EVENT_PUBLICATION_INVALID' then
        raise;
      end if;
  end;
end;
$$;
select pg_temp.assert_question_change(array[format(
  'delete from public.event_application_questions where event_id = %L', :'publication_guarded_id')], true);
select pg_temp.assert_question_change(array[format(
  'update public.event_application_questions set question = %L where event_id = %L', ' ', :'publication_guarded_id')], true);
select pg_temp.assert_question_change(array[
  format('insert into public.event_application_questions (event_id, question, response_type) values (%L, %L, %L)',
    :'publication_guarded_id', 'Why now?', 'long_text'),
  format('delete from public.event_application_questions where event_id = %L and question = %L',
    :'publication_guarded_id', 'Why?')], false);
select pg_temp.assert_question_change(array[
  format('update public.events set publish_at = null where id = %L', :'publication_guarded_id'),
  format('delete from public.event_application_questions where event_id = %L', :'publication_guarded_id')], false);
select pg_temp.assert_question_change(array[
  format('delete from public.events where id = %L', :'publication_guarded_id')], false);

delete from public.events where slug in ('rls-publication-sibling', 'rls-publication-sibling-2',
  'rls-publication-no-questions', 'rls-publication-guarded');
set constraints all immediate;
set constraints public.event_publication_questions, public.event_application_questions_publication deferred;
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
  perform public.publish_due_events();
  if not exists (select 1 from event_publication.blocked b join public.events e on e.id = b.event_id
    where e.slug = 'rls-event' and e.status = 'draft') then
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
  if exists (select 1 from event_publication.blocked b join public.events e on e.id = b.event_id
    where e.slug = 'rls-event') then
    raise exception 'successful publication retains its block';
  end if;
  if not exists (select 1 from event_publication.watchdog where next_check_at is not null)
    and exists (select 1 from cron.job where jobname = 'check-event-publication') then
    raise exception 'watchdog job remains with no checks pending';
  end if;
end;
$$;

-- Exercise the actual upgrade SQL against legacy rows. Remove only the new
-- guard/constraint within this rollback-only transaction to recreate old data.
set constraints all immediate;
drop trigger guard_event_publish_schedule on public.events;
drop function public.guard_event_publish_schedule();
alter table public.events drop constraint events_publish_schedule_requires_draft;
drop index public.events_pending_publication_idx;
drop function public.publish_due_events();
insert into public.events (short_description, starts_at, ends_at, name, description, regular_price, member_price, max_capacity, slug, status, publish_at)
values
 ('Legacy event', now()+interval '5 days', now()+interval '6 days', 'Legacy scheduled', 'Rollback fixture', 0, 0, 10, 'rls-legacy-scheduled', 'active', now() + interval '2 days'),
 ('Legacy event', now()+interval '5 days', now()+interval '6 days', 'Legacy published', 'Rollback fixture', 0, 0, 10, 'rls-legacy-published', 'active', now() - interval '2 days'),
 ('Legacy event', now()+interval '5 days', now()+interval '6 days', 'Legacy draft', 'Rollback fixture', 0, 0, 10, 'rls-legacy-draft', 'draft', now() + interval '2 days');
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
  if not exists (select 1 from public.events where slug = 'rls-legacy-draft'
    and status = 'draft' and publish_at = now() + interval '2 days') then
    raise exception 'migration lost a draft schedule';
  end if;
end;
$$;
