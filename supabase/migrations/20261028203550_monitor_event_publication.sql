-- A bounded watchdog, armed only around expected publication runs. Its private
-- state is not exposed through PostgREST and cannot be read by application users.
create extension if not exists pg_net with schema extensions;
create schema event_publication;
revoke all on schema event_publication from public, anon, authenticated, service_role;

create table event_publication.watchdog (
  event_id uuid primary key references public.events(id) on delete cascade,
  publish_at timestamptz not null,
  expected_run_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_check_at timestamptz,
  request_ids bigint[] not null default '{}',
  last_delivery_status text,
  last_response_status text
);
alter table event_publication.watchdog enable row level security;
revoke all on event_publication.watchdog from public, anon, authenticated, service_role;

create function event_publication.reschedule_watchdog()
returns void language plpgsql security definer set search_path = '' as $$
declare
  next_at timestamptz;
  run_at timestamp;
  job record;
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  select min(next_check_at) into next_at from event_publication.watchdog;
  if next_at is null then
    for job in select jobid from cron.job
      where jobname = 'check-event-publication' and username = current_user
    loop
      perform cron.unschedule(job.jobid);
    end loop;
    return;
  end if;
  -- Round up and guard against missed checks after downtime. The worker also
  -- compares full timestamps because cron expressions contain no year.
  next_at := greatest(date_trunc('minute', next_at) +
    case when next_at = date_trunc('minute', next_at) then interval '0' else interval '1 minute' end,
    date_trunc('minute', clock_timestamp()) + interval '1 minute');
  run_at := next_at at time zone coalesce(current_setting('cron.timezone', true), 'GMT');
  perform cron.schedule('check-event-publication', format('%s %s %s %s *',
    extract(minute from run_at)::integer, extract(hour from run_at)::integer,
    extract(day from run_at)::integer, extract(month from run_at)::integer),
    'select event_publication.check_publication()');
end;
$$;

create function event_publication.sync_watchdog()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  delete from event_publication.watchdog w
    where not exists (select 1 from public.events e
      where e.id = w.event_id and e.status = 'draft' and e.publish_at is not null);
  insert into event_publication.watchdog (event_id, publish_at, expected_run_at, next_check_at)
    select id, publish_at, run_at, run_at + interval '5 minutes'
    from public.events e cross join lateral (
      select greatest(date_trunc('minute', e.publish_at) +
        case when e.publish_at = date_trunc('minute', e.publish_at)
          then interval '0' else interval '1 minute' end,
        date_trunc('minute', clock_timestamp()) + interval '1 minute') as run_at
    ) scheduled
    where status = 'draft' and publish_at is not null
    on conflict (event_id) do update set
      publish_at = excluded.publish_at,
      expected_run_at = excluded.expected_run_at,
      attempts = 0,
      next_check_at = excluded.next_check_at,
      request_ids = '{}',
      last_delivery_status = null,
      last_response_status = null
    -- Unrelated writes, failed publisher retries and recovery runs must never
    -- extend the monitoring window or restart an exhausted attempt budget.
    where watchdog.publish_at is distinct from excluded.publish_at;
  perform event_publication.reschedule_watchdog();
  return null;
end;
$$;

create trigger sync_event_publication_watchdog
 after insert or delete or update of status, publish_at on public.events
 for each statement execute function event_publication.sync_watchdog();

create function event_publication.check_publication()
returns void language plpgsql security definer set search_path = '' as $$
declare
  checked_at timestamptz := clock_timestamp();
  target_url text;
  token text;
  request_id bigint;
  delivery_status text;
  signed_at text;
  affected uuid[];
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);
  -- The last response stays inspectable by joining request_ids to
  -- net._http_response, including after the attempt budget is exhausted.
  update event_publication.watchdog w set last_response_status =
    case when r.timed_out then 'timeout'
      else 'http_' || coalesce(r.status_code::text, 'error') end
    from net._http_response r
    where r.id = w.request_ids[cardinality(w.request_ids)];

  select array_agg(event_id) into affected from event_publication.watchdog
    where next_check_at <= checked_at and attempts < 3;
  if affected is null then
    perform event_publication.reschedule_watchdog();
    return;
  end if;

  select decrypted_secret into target_url from vault.decrypted_secrets
    where name = 'event_publication_health_url';
  select decrypted_secret into token from vault.decrypted_secrets
    where name = 'event_publication_health_secret';

  if target_url is null or token is null or token = '' then
    delivery_status := 'configuration_missing';
  else
    begin
      -- pg_net's queue is readable to DB roles. Sign a short-lived timestamp;
      -- never put the Vault secret itself in its URL, headers or body.
      signed_at := floor(extract(epoch from checked_at))::bigint::text;
      request_id := net.http_post(url := target_url,
        headers := jsonb_build_object('x-publication-timestamp', signed_at,
          'x-publication-signature', encode(extensions.hmac('event-publication:' || signed_at, token, 'sha256'), 'hex'),
          'Content-Type', 'application/json'),
        body := '{}'::jsonb, timeout_milliseconds := 10000);
      delivery_status := 'queued';
    exception when others then
      -- Never persist SQLERRM: it may contain the URL, token or event data.
      delivery_status := 'enqueue_failed_' || sqlstate;
    end;
  end if;

  update event_publication.watchdog set
    attempts = attempts + 1,
    next_check_at = case when attempts + 1 < 3 then checked_at + interval '5 minutes' end,
    request_ids = case when request_id is null then request_ids else array_append(request_ids, request_id) end,
    last_delivery_status = delivery_status
    where event_id = any(affected);

  -- Exhaustion stops health checks, not the publisher's minute retries.
  perform event_publication.reschedule_watchdog();
  delete from cron.job_run_details where command = 'select event_publication.check_publication()'
    and database = current_database() and username = current_user
    and end_time < checked_at - interval '7 days';
end;
$$;

revoke all on all functions in schema event_publication from public, anon, authenticated, service_role;

-- Reconcile existing schedules through the same trigger without changing data.
update public.events set publish_at = publish_at where status = 'draft' and publish_at is not null;
