-- Publish each due draft on its own, so one unready draft cannot hold back the
-- others. A draft that fails for a lasting reason is recorded as blocked and
-- waits for the hourly recovery run instead of a retry every minute; transient
-- failures (lock, serialization, resource) keep the minute retry. The watchdog
-- endpoint reads the blocked drafts through event_publication_health(), and a
-- deferred guard stops application questions being removed from a scheduled or
-- active event that requires an application.

-- 1. Blocked drafts ----------------------------------------------------------

-- A block applies to one publish date: changing the date (or publishing,
-- cancelling or deleting the event) clears it. reason is a hint code or a
-- SQLSTATE, never the exception message, which can quote row data.
create table event_publication.blocked (
  event_id uuid primary key references public.events(id) on delete cascade,
  publish_at timestamptz not null,
  reason text not null,
  failures integer not null default 1 check (failures > 0),
  first_failed_at timestamptz not null,
  last_failed_at timestamptz not null
);
alter table event_publication.blocked enable row level security;
revoke all on event_publication.blocked from public, anon, authenticated, service_role;

-- 2. Scheduling --------------------------------------------------------------

-- As in 20261027230347, except that a blocked draft no longer sets the next
-- minute run. The hourly recovery job stays while any schedule exists, so a
-- blocked draft is still retried every hour.
create or replace function public.reschedule_event_publication()
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

  -- A block lasts only while the draft keeps the date it failed at.
  delete from event_publication.blocked b
    where not exists (select 1 from public.events e
      where e.id = b.event_id and e.status = 'draft' and e.publish_at = b.publish_at);

  select min(e.publish_at) into next_publish_at
    from public.events e
    where e.status = 'draft' and e.publish_at is not null
      and not exists (select 1 from event_publication.blocked b
        where b.event_id = e.id and b.publish_at = e.publish_at);

  -- Opportunistic retention, scoped to these jobs, requires no cleanup timer.
  delete from cron.job_run_details
    where command = 'select public.publish_due_events()'
      and database = current_database() and username = current_user
      and end_time < clock_timestamp() - interval '7 days';

  if not exists (select 1 from public.events where status = 'draft' and publish_at is not null) then
    for job in select jobid from cron.job
      where jobname in ('publish-due-events', 'recover-event-publication')
        and username = current_user
    loop
      perform cron.unschedule(job.jobid);
    end loop;
    return;
  end if;

  if next_publish_at is null then
    -- Only blocked drafts remain: they wait for the hourly recovery run.
    for job in select jobid from cron.job
      where jobname = 'publish-due-events' and username = current_user
    loop
      perform cron.unschedule(job.jobid);
    end loop;
  else
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
  end if;

  if not exists (select 1 from cron.job where jobname = 'recover-event-publication'
    and username = current_user and schedule = '17 * * * *' and active) then
    perform cron.schedule('recover-event-publication', '17 * * * *', 'select public.publish_due_events()');
  end if;
end;
$$;
revoke all on function public.reschedule_event_publication() from public, anon, authenticated, service_role;

-- 3. Publishing --------------------------------------------------------------

-- Returns the number of drafts published, or -1 when the run itself failed
-- (outside any one draft), in which case nothing changed and a minute retry is
-- committed instead.
create or replace function public.publish_due_events()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  published_count integer := 0;
  updated_count integer;
  due record;
  failed_state text;
  failed_hint text;
  failed_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  begin
    -- The questions guard is deferred to commit, where one draft's failure
    -- would undo every other draft's publication and escape the handlers
    -- below. Check it at each draft's own update instead. A subtransaction
    -- that rolls back restores the mode it started with, so the outer handler
    -- also returns the guard to deferred.
    set constraints public.event_publication_questions immediate;

    for due in
      select id, publish_at from public.events
      where status = 'draft' and publish_at <= clock_timestamp()
      order by publish_at, id
    loop
      begin
        -- The timestamp predicate also guards against cron's lack of a year
        -- field and any duplicate/recovery runs. The AFTER trigger schedules
        -- the next job.
        update public.events set status = 'active', publish_at = null
          where id = due.id and status = 'draft' and publish_at = due.publish_at;
        get diagnostics updated_count = row_count;
        published_count := published_count + updated_count;
      -- OTHERS excludes query_canceled, so name it: a statement timeout on
      -- one draft is transient and must not abort the rest of the run.
      exception when query_canceled or others then
        -- Never log or store SQLERRM: it can quote row data. Hints here are
        -- codes such as EVENT_PUBLICATION_INVALID.
        get stacked diagnostics failed_state = returned_sqlstate, failed_hint = pg_exception_hint;
        failed_hint := nullif(failed_hint, '');
        if failed_state like '40%' or failed_state like '53%' or failed_state in ('55P03', '57014') then
          raise warning 'Event % publication failed (SQLSTATE %, hint %); retrying next minute.',
            due.id, failed_state, coalesce(failed_hint, 'none');
        else
          failed_at := clock_timestamp();
          insert into event_publication.blocked as b
            (event_id, publish_at, reason, failures, first_failed_at, last_failed_at)
          values (due.id, due.publish_at, coalesce(failed_hint, failed_state), 1, failed_at, failed_at)
          on conflict (event_id) do update set
            failures = case when b.publish_at = excluded.publish_at then b.failures + 1 else 1 end,
            first_failed_at = case when b.publish_at = excluded.publish_at
              then b.first_failed_at else excluded.first_failed_at end,
            publish_at = excluded.publish_at,
            reason = excluded.reason,
            last_failed_at = excluded.last_failed_at;
          raise warning 'Event % publication blocked (SQLSTATE %, hint %); retrying hourly.',
            due.id, failed_state, coalesce(failed_hint, 'none');
        end if;
      end;
    end loop;

    set constraints public.event_publication_questions deferred;
    -- A run that published nothing fires no AFTER trigger, so reschedule here:
    -- a transient failure retries next minute, a blocked draft waits an hour.
    perform public.reschedule_event_publication();
    return published_count;
  exception when others then
    -- The failed run rolls back, but this retry commits. Never include row
    -- data or the exception message in logs. Recovery also survives a DB outage.
    perform cron.schedule('publish-due-events', '* * * * *', 'select public.publish_due_events()');
    raise warning 'Event publication failed (SQLSTATE %); retry scheduled.', sqlstate;
    return -1;
  end;
end;
$$;
revoke all on function public.publish_due_events() from public, anon, authenticated;
grant execute on function public.publish_due_events() to service_role;

-- 4. Health ------------------------------------------------------------------

-- What the watchdog endpoint reports: drafts still unpublished at p_before,
-- and the drafts blocked at their current publish date.
create or replace function public.event_publication_health(p_before timestamptz)
returns table (overdue_count integer, blocked_count integer, blocked_event_ids uuid[])
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::integer from public.events
      where status = 'draft' and publish_at <= p_before),
    count(b.event_id)::integer,
    coalesce(array_agg(b.event_id order by b.first_failed_at, b.event_id), '{}')
  from event_publication.blocked b
  join public.events e on e.id = b.event_id and e.status = 'draft' and e.publish_at = b.publish_at;
$$;
revoke all on function public.event_publication_health(timestamptz) from public, anon, authenticated;
grant execute on function public.event_publication_health(timestamptz) to service_role;

-- 5. Application questions ---------------------------------------------------

-- guard_event_publication_questions re-checks only when an event's status,
-- publish date or requires_application changes. Run the same check when a
-- question is deleted or its text changes, at commit, so a save that replaces
-- every question still passes. A deleted event takes its questions with it.
create or replace function public.guard_event_application_question_removal()
returns trigger
language plpgsql
set search_path = '' as $$
declare e public.events;
begin
  select * into e from public.events where id = old.event_id;
  if not found then return null; end if;
  if (e.status = 'active' or e.publish_at is not null) and e.requires_application and not exists (
    select 1 from public.event_application_questions
    where event_id = e.id and nullif(btrim(question), '') is not null
  ) then
    raise exception 'Applications require at least one valid question before publication.'
      using hint = 'EVENT_PUBLICATION_INVALID';
  end if;
  return null;
end;
$$;
revoke all on function public.guard_event_application_question_removal() from public, anon, authenticated;

create constraint trigger event_application_questions_publication
  after delete or update of question on public.event_application_questions
  deferrable initially deferred
  for each row execute function public.guard_event_application_question_removal();
