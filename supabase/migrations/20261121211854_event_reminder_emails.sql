-- Event reminder emails (supabase/README.md, "Event reminder emails").
--
-- Ticket holders get a short reminder a day and/or two hours before an event
-- starts, as the event's admins choose in the builder. A pg_cron job calls
-- /api/internal/event-reminders every 15 minutes, but only when a reminder is
-- due and both Vault secrets are set, which they are in production alone:
-- preview deploys share this database, so the job must never call anything
-- but the URL stored in Vault. It signs with the application emails secret.
--
-- 1. `events.reminder_schedule`: 'off', '1d', '2h' or 'both'. It defaults to
--    'off', so every existing event, published or not, sends nothing. The
--    builder's form starts a new event at '1d' and saves the field through
--    save_admin_event_builder, whose writer copies every payload key that
--    names an events column (save_admin_event_before_date_locations), so the
--    save needs no change. Old code never sends the key, so it keeps the
--    stored value.
-- 2. `event_reminders.sends`: one row per reminder kind per ticket, unique on
--    (ticket_id, kind), so nobody is reminded twice. A voided or refunded
--    ticket is deleted, and its rows with it.
-- 3. `event_reminders.due_work`: what is due. A kind is due from its send
--    time (24 or 2 hours before `starts_at`, the first day of a multi-day
--    event) until it would be stale: six hours later for the day-before
--    reminder, the start for the two-hour one. Only for an active, uncanceled
--    event whose setting includes the kind, a live holder, and a ticket that
--    existed at the send time.
-- 4. `claim_event_reminders`, `complete_event_reminder` and
--    `release_event_reminders` (service role only), as the application
--    emails: the route claims a batch, then records each send. A failure
--    releases the claim to retry, up to five attempts; a stale claim (the
--    route died) is retried after 15 minutes.
-- 5. The `send-event-reminders` cron job.
--
-- Additive: one new column with a default, and new objects. No existing
-- function, policy or trigger changes.

-- 1. The setting ----------------------------------------------------------------

alter table public.events
  add column reminder_schedule text not null default 'off'
  constraint events_reminder_schedule_check
  check (reminder_schedule in ('off', '1d', '2h', 'both'));

comment on column public.events.reminder_schedule is
  'Which reminder emails ticket holders get before the event starts: off, 1d (a day before), 2h (two hours before) or both.';

create schema event_reminders;
revoke all on schema event_reminders from public, anon, authenticated, service_role;

-- 2. Sends ------------------------------------------------------------------------

create table event_reminders.sends (
  id              uuid        primary key default gen_random_uuid(),
  ticket_id       uuid        not null references public.event_tickets (id) on delete cascade,
  kind            text        not null check (kind in ('1d', '2h')),
  claimed_at      timestamptz,
  sent_at         timestamptz,
  attempts        integer     not null default 0 check (attempts between 0 and 5),
  -- A Resend error name or our own code, never a message (which can quote
  -- the address).
  last_error_code text,
  created_at      timestamptz not null default now(),
  constraint event_reminder_sends_unique unique (ticket_id, kind)
);

alter table event_reminders.sends enable row level security;
revoke all on event_reminders.sends from public, anon, authenticated, service_role;

-- 3. What is due ------------------------------------------------------------------

-- Every reminder due now, optionally for some events only. A row already
-- sent, claimed in the last 15 minutes, or out of attempts is not due.
create function event_reminders.due_work(p_event_ids uuid[] default null)
returns table (ticket_id uuid, kind text)
language sql stable security definer set search_path = '' as $$
  select ticket.id, reminder.kind
  from public.events event
  cross join lateral (
    values ('1d', interval '24 hours', interval '18 hours'),
           ('2h', interval '2 hours', interval '0 hours')
  ) reminder (kind, lead_time, stale_after)
  join public.event_tickets ticket on ticket.event_id = event.id
  join public.user_info holder on holder.id = ticket.user_id
  where (p_event_ids is null or event.id = any (p_event_ids))
    and event.reminder_schedule in (reminder.kind, 'both')
    and event.status = 'active'
    and event.canceled_at is null
    and event.starts_at is not null
    and now() >= event.starts_at - reminder.lead_time
    and now() < event.starts_at - reminder.stale_after
    -- Registered after the send time: this reminder isn't theirs.
    and ticket.created_at <= event.starts_at - reminder.lead_time
    and holder.deleted_at is null
    -- A refund normally takes the ticket back; a checked-in ticket is kept.
    and not exists (
      select 1 from public.purchases purchase
      where purchase.id = ticket.purchase_id
        and purchase.amount_cents > 0
        and purchase.refunded_cents >= purchase.amount_cents
    )
    and not exists (
      select 1 from event_reminders.sends send
      where send.ticket_id = ticket.id
        and send.kind = reminder.kind
        and (
          send.sent_at is not null
          or send.attempts >= 5
          or send.claimed_at > now() - interval '15 minutes'
        )
    );
$$;

-- Where the holder goes: the first day's location (or the event's), in full,
-- as event_participant_content shows a ticket holder. Events without the
-- dates editor fall back to the stored location columns.
create function event_reminders.ticket_location(p_event_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (
      select public.participant_agenda_location(
        coalesce(nullif(day.value -> 'location', 'null'::jsonb), settings.document -> 'location'),
        false
      )
      from public.event_date_location_settings settings
      left join lateral (
        select value from jsonb_array_elements(coalesce(settings.document -> 'dates', '[]'::jsonb))
        order by value ->> 'date', value ->> 'key'
        limit 1
      ) day on true
      where settings.event_id = p_event_id
    ),
    (
      select jsonb_strip_nulls(jsonb_build_object(
        'type', event.location_type::text,
        'restricted', false,
        'building', nullif(event.location_building, ''),
        'room', nullif(event.location_room, ''),
        'address', nullif(event.location_address, ''),
        'map_url', nullif(event.location_address_url, '')
      ))
      from public.events event
      where event.id = p_event_id
    )
  );
$$;

-- 4. Claiming and completing ------------------------------------------------------

-- Claims up to p_limit due reminders (at most 100) and returns what the route
-- needs to send each. `attempts` counts this one. Tickets being voided right
-- now are skipped, not waited on. Two-hour reminders go first: they run out.
create function public.claim_event_reminders(
  p_limit integer default 25,
  p_event_ids uuid[] default null
)
returns table (
  send_id     uuid,
  kind        text,
  attempts    integer,
  ticket_id   uuid,
  event_id    uuid,
  email       text,
  first_name  text,
  event_name  text,
  event_slug  text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  location    jsonb
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select due.ticket_id, due.kind
    from event_reminders.due_work(p_event_ids) due
    join public.event_tickets ticket on ticket.id = due.ticket_id
    order by (due.kind = '2h') desc, ticket.created_at, ticket.id
    limit greatest(least(coalesce(p_limit, 25), 100), 0)
    for update of ticket skip locked
  ), claimed as (
    insert into event_reminders.sends as send (ticket_id, kind, claimed_at, attempts)
    select picked.ticket_id, picked.kind, now(), 1
    from picked
    on conflict (ticket_id, kind) do update
      set claimed_at = now(), attempts = send.attempts + 1
      where send.sent_at is null
        and send.attempts < 5
        and (send.claimed_at is null or send.claimed_at <= now() - interval '15 minutes')
    returning send.id, send.ticket_id, send.kind, send.attempts
  )
  select
    claimed.id,
    claimed.kind,
    claimed.attempts,
    ticket.id,
    event.id,
    holder.email,
    holder.first_name,
    event.name,
    event.slug,
    event.starts_at,
    event.ends_at,
    event_reminders.ticket_location(event.id)
  from claimed
  join public.event_tickets ticket on ticket.id = claimed.ticket_id
  join public.events event on event.id = ticket.event_id
  join public.user_info holder on holder.id = ticket.user_id;
end;
$$;

-- Records one claimed reminder: sent, or failed with a short code (a Resend
-- error name), which releases the claim so the next run retries it until it
-- has had five attempts. Returns the attempts so far, or null when the send
-- isn't claimed (already completed or released, or the ticket is gone).
create function public.complete_event_reminder(
  p_send_id uuid,
  p_sent boolean,
  p_error_code text default null
)
returns integer
language sql security definer set search_path = '' as $$
  update event_reminders.sends
  set sent_at = case when p_sent then now() end,
      claimed_at = case when p_sent then claimed_at end,
      last_error_code = case when p_sent then null
        else left(coalesce(nullif(p_error_code, ''), 'UNKNOWN'), 64) end
  where id = p_send_id
    and sent_at is null
    and claimed_at is not null
  returning attempts;
$$;

-- Hands back claims the route didn't try (Resend's rate limit or daily quota,
-- or no API key), without counting an attempt. Returns how many it released.
create function public.release_event_reminders(
  p_send_ids uuid[],
  p_reason text default null
)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update event_reminders.sends
  set claimed_at = null,
      attempts = greatest(attempts - 1, 0),
      last_error_code = left(coalesce(nullif(p_reason, ''), last_error_code), 64)
  where id = any (p_send_ids)
    and sent_at is null
    and claimed_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_event_reminders(integer, uuid[]) from public, anon, authenticated;
revoke all on function public.complete_event_reminder(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.release_event_reminders(uuid[], text) from public, anon, authenticated;
grant execute on function public.claim_event_reminders(integer, uuid[]) to service_role;
grant execute on function public.complete_event_reminder(uuid, boolean, text) to service_role;
grant execute on function public.release_event_reminders(uuid[], text) to service_role;

-- 5. The job ----------------------------------------------------------------------

-- Every 15 minutes: when a reminder is due and both Vault secrets are set,
-- POST to the stored URL, signed as the application emails job signs, with
-- the same secret but its own message: an HMAC over
-- `event-reminders:<unix-seconds>`, so neither job's signature opens the
-- other's route. Never the secret itself, since pg_net's queue is readable
-- to database roles.
create function event_reminders.dispatch()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
  v_signed_at text;
begin
  delete from cron.job_run_details
  where command = 'select event_reminders.dispatch()'
    and database = current_database() and username = current_user
    and end_time < now() - interval '7 days';

  if not exists (select 1 from event_reminders.due_work(null)) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets
  where name = 'event_reminders_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets
  where name = 'application_emails_secret';
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return;
  end if;

  v_signed_at := floor(extract(epoch from clock_timestamp()))::bigint::text;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'x-event-reminders-timestamp', v_signed_at,
      'x-event-reminders-signature',
        encode(extensions.hmac('event-reminders:' || v_signed_at, v_secret, 'sha256'), 'hex'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    -- A batch of 50 is paced under Resend's per-second limit.
    timeout_milliseconds := 60000);
exception when others then
  -- Never surface SQLERRM: it can quote the URL or the secret.
  raise warning 'event_reminders.dispatch failed (SQLSTATE %)', sqlstate;
end;
$$;

revoke all on all functions in schema event_reminders from public, anon, authenticated, service_role;

select cron.schedule('send-event-reminders', '*/15 * * * *', 'select event_reminders.dispatch()');
