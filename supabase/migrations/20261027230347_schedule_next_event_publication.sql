-- Wake at the next publication minute instead of polling every ten seconds.
-- A conditional hourly recovery job catches missed runs after database downtime.
-- Both jobs disappear when there are no scheduled drafts.

create function public.lock_event_publication_schedule()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Lock BEFORE touching event rows. Taking this lock only in an AFTER trigger
  -- would deadlock against a publisher that already holds it and needs a row.
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  return null;
end;
$$;
revoke all on function public.lock_event_publication_schedule() from public, anon, authenticated, service_role;

create trigger lock_event_publication_schedule
before insert or delete or update of status, publish_at on public.events
for each statement execute function public.lock_event_publication_schedule();

create function public.reschedule_event_publication()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  next_publish_at timestamptz;
  run_at timestamptz;
  local_run_at timestamp;
  next_schedule text;
  job record;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  select min(publish_at) into next_publish_at
    from public.events where status = 'draft' and publish_at is not null;

  -- Opportunistic retention, scoped to these jobs, requires no cleanup timer.
  delete from cron.job_run_details
    where command = 'select public.publish_due_events()'
      and database = current_database() and username = current_user
      and end_time < clock_timestamp() - interval '7 days';

  if next_publish_at is null then
    for job in select jobid from cron.job
      where jobname in ('publish-due-events', 'recover-event-publication')
        and username = current_user
    loop
      perform cron.unschedule(job.jobid);
    end loop;
    return;
  end if;

  run_at := date_trunc('minute', next_publish_at);
  if run_at < next_publish_at then
    run_at := run_at + interval '1 minute';
  end if;
  run_at := greatest(run_at, date_trunc('minute', clock_timestamp()) + interval '1 minute');
  local_run_at := run_at at time zone coalesce(current_setting('cron.timezone', true), 'GMT');
  next_schedule := format('%s %s %s %s *',
    extract(minute from local_run_at)::integer,
    extract(hour from local_run_at)::integer,
    extract(day from local_run_at)::integer,
    extract(month from local_run_at)::integer);

  if not exists (select 1 from cron.job where jobname = 'publish-due-events'
    and username = current_user and schedule = next_schedule and active) then
    perform cron.schedule('publish-due-events', next_schedule, 'select public.publish_due_events()');
  end if;
  if not exists (select 1 from cron.job where jobname = 'recover-event-publication'
    and username = current_user and schedule = '17 * * * *' and active) then
    perform cron.schedule('recover-event-publication', '17 * * * *', 'select public.publish_due_events()');
  end if;
end;
$$;
revoke all on function public.reschedule_event_publication() from public, anon, authenticated, service_role;

create function public.reschedule_event_publication_after_write()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.reschedule_event_publication();
  return null;
end;
$$;
revoke all on function public.reschedule_event_publication_after_write() from public, anon, authenticated, service_role;

create trigger reschedule_event_publication_after_write
 after insert or delete or update of status, publish_at on public.events
 for each statement execute function public.reschedule_event_publication_after_write();

create or replace function public.publish_due_events()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  published_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  begin
    -- The timestamp predicate also guards against cron's lack of a year field
    -- and any duplicate/recovery runs. The AFTER trigger schedules the next job.
    update public.events set status = 'active', publish_at = null
      where status = 'draft' and publish_at <= clock_timestamp();
    get diagnostics published_count = row_count;
    return published_count;
  exception when others then
    -- The failed update rolls back, but this retry commits. Never include row
    -- data or the exception message in logs. Recovery also survives a DB outage.
    perform cron.schedule('publish-due-events', '* * * * *', 'select public.publish_due_events()');
    raise warning 'Event publication failed (SQLSTATE %); retry scheduled.', sqlstate;
    return -1;
  end;
end;
$$;
revoke all on function public.publish_due_events() from public, anon, authenticated;
grant execute on function public.publish_due_events() to service_role;

-- Replace the old polling job and reconcile any existing schedules.
select public.reschedule_event_publication();
