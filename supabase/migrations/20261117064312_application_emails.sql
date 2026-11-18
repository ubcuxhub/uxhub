-- Application emails (docs/event-states.md, "Application emails";
-- supabase/README.md, "Application emails").
--
-- Applicants get a plain email once their decision is released (accepted,
-- waitlisted or not selected) and a reminder 24 hours before an accepted offer
-- expires. A pg_cron job calls /api/internal/application-emails every five
-- minutes, but only when there is work and both Vault secrets are set, which
-- they are in production alone: preview deploys share this database, so the
-- job must never call anything but the URL stored in Vault.
--
-- 1. `application_emails.deliveries`: one row per email per application, unique
--    on (application_id, kind, key). `key` is the status for a decision and
--    the offer deadline for a reminder, so a changed decision or a moved
--    deadline sends again, and nothing sends twice.
-- 2. `application_emails.due_work`: what is due. Released decisions, and
--    accepted, unexpired offers due within 24 hours whose acceptance email
--    went out before that window opened. Never for a draft or canceled or
--    finished event, a deleted applicant, or someone who already registered.
-- 3. Backfill: everything already due is marked sent, so deploying emails
--    nobody.
-- 4. `claim_application_emails`, `complete_application_email` and
--    `release_application_emails` (service role only): the route claims a
--    batch, then records each send. A failure releases the claim to retry,
--    up to five attempts; a stale claim (the route died) is retried after 15
--    minutes.
-- 5. The `send-application-emails` cron job.
--
-- Additive: no existing table, function or policy changes.

create schema application_emails;
revoke all on schema application_emails from public, anon, authenticated, service_role;

-- 1. Deliveries ---------------------------------------------------------------

create table application_emails.deliveries (
  id              uuid        primary key default gen_random_uuid(),
  application_id  uuid        not null references public.event_applications (id) on delete cascade,
  kind            text        not null
                  check (kind in ('accepted', 'waitlisted', 'rejected', 'offer_reminder')),
  key             text        not null,
  claimed_at      timestamptz,
  sent_at         timestamptz,
  attempts        integer     not null default 0 check (attempts between 0 and 5),
  -- A Resend error name or our own code, never a message (which can quote
  -- the address).
  last_error_code text,
  created_at      timestamptz not null default now(),
  constraint application_email_deliveries_unique unique (application_id, kind, key)
);

alter table application_emails.deliveries enable row level security;
revoke all on application_emails.deliveries from public, anon, authenticated, service_role;

-- The reminder key: the deadline in UTC, to the second.
create function application_emails.deadline_key(p_deadline timestamptz)
returns text
language sql immutable set search_path = '' as $$
  select to_char(p_deadline at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
$$;

-- 2. What is due --------------------------------------------------------------

-- Every email due now, optionally for some events only. A row already sent,
-- claimed in the last 15 minutes, or out of attempts is not due.
create function application_emails.due_work(p_event_ids uuid[] default null)
returns table (application_id uuid, kind text, key text)
language sql stable security definer set search_path = '' as $$
  select application.id, work.kind, work.key
  from public.event_applications application
  join public.events event on event.id = application.event_id
  join public.user_info applicant on applicant.id = application.user_id
  cross join lateral (
    -- The decision, once released. An offer that expired before we sent it
    -- would only tell them about a spot that's gone.
    select application.status::text, application.status::text
    where application.status in ('accepted', 'waitlisted', 'rejected')
      and (application.status <> 'accepted' or application.offer_expires_at > now())
    union all
    -- A day before the deadline, unless the acceptance itself went out inside
    -- that day (it names the deadline).
    select 'offer_reminder', application_emails.deadline_key(application.offer_expires_at)
    where application.status = 'accepted'
      and application.offer_expires_at > now()
      and application.offer_expires_at <= now() + interval '24 hours'
      and exists (
        select 1 from application_emails.deliveries accepted
        where accepted.application_id = application.id
          and accepted.kind = 'accepted'
          and accepted.key = 'accepted'
          and accepted.sent_at is not null
          and accepted.sent_at <= application.offer_expires_at - interval '24 hours'
      )
  ) work (kind, key)
  where (p_event_ids is null or application.event_id = any (p_event_ids))
    and event.requires_application
    and event.status = 'active'
    and event.canceled_at is null
    and coalesce(event.ends_at, event.starts_at, 'infinity'::timestamptz) > now()
    and applicant.deleted_at is null
    and public.application_decisions_released(application.event_id)
    and not exists (
      select 1 from public.event_tickets ticket
      where ticket.event_id = application.event_id
        and ticket.user_id = application.user_id
    )
    and not exists (
      select 1 from application_emails.deliveries delivery
      where delivery.application_id = application.id
        and delivery.kind = work.kind
        and delivery.key = work.key
        and (
          delivery.sent_at is not null
          or delivery.attempts >= 5
          or delivery.claimed_at > now() - interval '15 minutes'
        )
    );
$$;

-- 3. Backfill -----------------------------------------------------------------

-- Marks everything due now as sent, without sending: decisions first, then
-- the reminders already due, whether or not their acceptance was emailed.
-- Run once below; supabase/tests/application-emails.sql runs it again.
create function application_emails.backfill(p_event_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_decisions integer;
  v_reminders integer;
begin
  insert into application_emails.deliveries as delivery
    (application_id, kind, key, sent_at, last_error_code)
  select due.application_id, due.kind, due.key, now(), 'BACKFILL'
  from application_emails.due_work(p_event_ids) due
  where due.kind <> 'offer_reminder'
  on conflict (application_id, kind, key) do update
    set sent_at = now(), claimed_at = null, last_error_code = 'BACKFILL'
    where delivery.sent_at is null;
  get diagnostics v_decisions = row_count;

  insert into application_emails.deliveries as delivery
    (application_id, kind, key, sent_at, last_error_code)
  select application.id, 'offer_reminder',
    application_emails.deadline_key(application.offer_expires_at), now(), 'BACKFILL'
  from public.event_applications application
  where (p_event_ids is null or application.event_id = any (p_event_ids))
    and application.status = 'accepted'
    and application.offer_expires_at > now()
    and application.offer_expires_at <= now() + interval '24 hours'
    and public.application_decisions_released(application.event_id)
  on conflict (application_id, kind, key) do update
    set sent_at = now(), claimed_at = null, last_error_code = 'BACKFILL'
    where delivery.sent_at is null;
  get diagnostics v_reminders = row_count;

  return v_decisions + v_reminders;
end;
$$;

select application_emails.backfill();

-- 4. Claiming and completing --------------------------------------------------

-- Claims up to p_limit due emails (at most 100) and returns what the route
-- needs to send each. `attempts` counts this one. Applications an admin is
-- deciding right now are skipped, not waited on, and the status is checked
-- again under the lock. Reminders go first: they run out.
create function public.claim_application_emails(
  p_limit integer default 25,
  p_event_ids uuid[] default null
)
returns table (
  delivery_id      uuid,
  kind             text,
  attempts         integer,
  application_id   uuid,
  event_id         uuid,
  email            text,
  first_name       text,
  event_name       text,
  event_slug       text,
  offer_expires_at timestamptz,
  starts_at        timestamptz,
  ends_at          timestamptz
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select due.application_id, due.kind, due.key
    from application_emails.due_work(p_event_ids) due
    join public.event_applications application on application.id = due.application_id
    where due.kind = application.status::text
       or (
         due.kind = 'offer_reminder'
         and application.status = 'accepted'
         and due.key = application_emails.deadline_key(application.offer_expires_at)
       )
    order by (due.kind = 'offer_reminder') desc, application.submitted_at nulls last, application.id
    limit greatest(least(coalesce(p_limit, 25), 100), 0)
    for update of application skip locked
  ), claimed as (
    insert into application_emails.deliveries as delivery
      (application_id, kind, key, claimed_at, attempts)
    select picked.application_id, picked.kind, picked.key, now(), 1
    from picked
    on conflict (application_id, kind, key) do update
      set claimed_at = now(), attempts = delivery.attempts + 1
      where delivery.sent_at is null
        and delivery.attempts < 5
        and (delivery.claimed_at is null or delivery.claimed_at <= now() - interval '15 minutes')
    returning delivery.id, delivery.application_id, delivery.kind, delivery.attempts
  )
  select
    claimed.id,
    claimed.kind,
    claimed.attempts,
    application.id,
    event.id,
    applicant.email,
    applicant.first_name,
    event.name,
    event.slug,
    application.offer_expires_at,
    event.starts_at,
    event.ends_at
  from claimed
  join public.event_applications application on application.id = claimed.application_id
  join public.events event on event.id = application.event_id
  join public.user_info applicant on applicant.id = application.user_id;
end;
$$;

-- Records one claimed email: sent, or failed with a short code (a Resend
-- error name), which releases the claim so the next run retries it until it
-- has had five attempts. Returns the attempts so far, or null when the
-- delivery isn't claimed (already completed or released).
create function public.complete_application_email(
  p_delivery_id uuid,
  p_sent boolean,
  p_error_code text default null
)
returns integer
language sql security definer set search_path = '' as $$
  update application_emails.deliveries
  set sent_at = case when p_sent then now() end,
      claimed_at = case when p_sent then claimed_at end,
      last_error_code = case when p_sent then null
        else left(coalesce(nullif(p_error_code, ''), 'UNKNOWN'), 64) end
  where id = p_delivery_id
    and sent_at is null
    and claimed_at is not null
  returning attempts;
$$;

-- Hands back claims the route didn't try (Resend's rate limit or daily quota,
-- or no API key), without counting an attempt. Returns how many it released.
create function public.release_application_emails(
  p_delivery_ids uuid[],
  p_reason text default null
)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update application_emails.deliveries
  set claimed_at = null,
      attempts = greatest(attempts - 1, 0),
      last_error_code = left(coalesce(nullif(p_reason, ''), last_error_code), 64)
  where id = any (p_delivery_ids)
    and sent_at is null
    and claimed_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_application_emails(integer, uuid[]) from public, anon, authenticated;
revoke all on function public.complete_application_email(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.release_application_emails(uuid[], text) from public, anon, authenticated;
grant execute on function public.claim_application_emails(integer, uuid[]) to service_role;
grant execute on function public.complete_application_email(uuid, boolean, text) to service_role;
grant execute on function public.release_application_emails(uuid[], text) to service_role;

-- 5. The job ------------------------------------------------------------------

-- Every five minutes: when something is due and both Vault secrets are set,
-- POST to the stored URL, signed as the publication watchdog signs: an HMAC
-- over `application-emails:<unix-seconds>`, never the secret itself, since
-- pg_net's queue is readable to database roles.
create function application_emails.dispatch()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
  v_signed_at text;
begin
  delete from cron.job_run_details
  where command = 'select application_emails.dispatch()'
    and database = current_database() and username = current_user
    and end_time < now() - interval '7 days';

  if not exists (select 1 from application_emails.due_work(null)) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets
  where name = 'application_emails_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets
  where name = 'application_emails_secret';
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return;
  end if;

  v_signed_at := floor(extract(epoch from clock_timestamp()))::bigint::text;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'x-application-emails-timestamp', v_signed_at,
      'x-application-emails-signature',
        encode(extensions.hmac('application-emails:' || v_signed_at, v_secret, 'sha256'), 'hex'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    -- A batch of 25 is paced under Resend's per-second limit.
    timeout_milliseconds := 60000);
exception when others then
  -- Never surface SQLERRM: it can quote the URL or the secret.
  raise warning 'application_emails.dispatch failed (SQLSTATE %)', sqlstate;
end;
$$;

revoke all on all functions in schema application_emails from public, anon, authenticated, service_role;

select cron.schedule('send-application-emails', '*/5 * * * *', 'select application_emails.dispatch()');
