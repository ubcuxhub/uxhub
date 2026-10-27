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

-- Cancelling or manually changing status removes unnecessary jobs.
update public.events set publish_at = null where id = :'event_id';
select pg_temp.assert_publication_jobs();
update public.events set publish_at = now() + interval '2 days' where id = :'event_id';
update public.events set status = 'archived' where id = :'event_id';
select pg_temp.assert_publication_jobs();

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
