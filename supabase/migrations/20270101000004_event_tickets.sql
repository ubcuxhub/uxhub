-- Migration: event_tickets table, backfill from event_registrations, repoint
-- check_ins, event_seat_counts function, reserve_event_ticket function.
--
-- Requirements addressed:
--   4.1  event_tickets: UNIQUE(event_id, user_id), unique nullable purchase_id,
--        unique qr_token (gen_random_bytes requires pgcrypto).
--   4.2  Backfill: existing registrations where attending=true OR purchase_id
--        IS NOT NULL become tickets; check_ins gains ticket_id FK.
--        Ticket UUID = registration UUID so check_ins backfill is a copy.
--   4.3  event_seat_counts(uuid[]) returns tickets, held_offers, seats_left.
--   4.4  reserve_event_ticket replaces reserve_paid_event_ticket; uses
--        registration_opens_at/closes_at and event_seat_counts; restricted to
--        service_role.
--
-- This migration is safe to run on a populated database.  The old
-- event_registrations table, event_registration_counts function, and
-- event_registration_id column on check_ins are NOT dropped here — they are
-- removed in the final clean-up migration (task 11) once the app code has
-- been updated.

set search_path = '';


-- ── 0. pgcrypto extension ─────────────────────────────────────────────────
--
-- Required for gen_random_bytes used in the qr_token default.
-- Already present in the base schema (20260111032511_remote_schema.sql), but
-- CREATE EXTENSION IF NOT EXISTS is idempotent so it is safe to repeat.

create extension if not exists pgcrypto with schema extensions;


-- ── 1. Create event_tickets ───────────────────────────────────────────────

create table public.event_tickets (
  id          uuid        not null default gen_random_uuid(),
  event_id    uuid        not null,
  user_id     uuid        not null,
  purchase_id uuid,
  qr_token    text        not null
                          default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint event_tickets_pkey
    primary key (id),
  constraint event_tickets_event_id_fkey
    foreign key (event_id) references public.events (id) on delete cascade,
  constraint event_tickets_user_id_fkey
    foreign key (user_id) references public.user_info (id),
  constraint event_tickets_purchase_id_fkey
    foreign key (purchase_id) references public.purchases (id) on delete set null,
  constraint event_tickets_event_id_user_id_key
    unique (event_id, user_id),
  constraint event_tickets_purchase_id_key
    unique (purchase_id),
  constraint event_tickets_qr_token_key
    unique (qr_token)
);

create index event_tickets_event_id_idx
  on public.event_tickets (event_id);

create index event_tickets_user_id_idx
  on public.event_tickets (user_id);

create trigger update_event_tickets_updated_at
  before update on public.event_tickets
  for each row execute function public.update_updated_at_column();


-- ── 2. RLS for event_tickets ──────────────────────────────────────────────

alter table public.event_tickets enable row level security;

-- Users may read their own tickets.
create policy "tickets: read own"
  on public.event_tickets
  for select
  to authenticated
  using (user_id = public.current_user_info_id());

-- Admins (and managers) may read every ticket.
create policy "tickets: admins read all"
  on public.event_tickets
  for select
  to authenticated
  using (public.is_admin());

-- Only service_role inserts tickets (via reserve_event_ticket or direct grant).
-- No INSERT policy for authenticated; service_role bypasses RLS by default on
-- tables owned by postgres, so no explicit policy is needed for it.


-- ── 3. Grants ─────────────────────────────────────────────────────────────

grant all on table public.event_tickets to service_role;
grant select on table public.event_tickets to authenticated;


-- ── 4. Backfill event_tickets from event_registrations ───────────────────
--
-- Criteria (Requirement 4.2): attending = true OR purchase_id IS NOT NULL.
-- We preserve the same UUID as the source registration row so that the
-- check_ins backfill in section 5 can simply copy event_registration_id.
-- ON CONFLICT DO NOTHING makes the backfill idempotent.

insert into public.event_tickets (
  id,
  event_id,
  user_id,
  purchase_id,
  qr_token,
  created_at,
  updated_at
)
select
  reg.id,
  reg.event_id,
  reg.user_id,
  reg.purchase_id,
  encode(extensions.gen_random_bytes(16), 'hex'),
  reg.created_at,
  reg.updated_at
from public.event_registrations reg
where reg.attending = true
   or reg.purchase_id is not null
on conflict (event_id, user_id) do nothing;


-- ── 5. Repoint check_ins → event_tickets ─────────────────────────────────
--
-- Add ticket_id FK column and backfill it.  Because section 4 preserved the
-- UUID of each registration, ticket_id = event_registration_id for every row
-- that was backfilled.  Rows whose registration was NOT backfilled (no ticket
-- yet) are left with ticket_id = NULL for now; they will be resolved when
-- the ticket is eventually created.
--
-- event_registration_id is NOT dropped here — that happens in the clean-up
-- migration once the app code stops referencing it.

alter table public.check_ins
  add column if not exists ticket_id uuid
    references public.event_tickets (id) on delete cascade;

-- Backfill: set ticket_id where a matching ticket exists.
update public.check_ins ci
set ticket_id = ci.event_registration_id
where ci.ticket_id is null
  and exists (
    select 1
    from public.event_tickets t
    where t.id = ci.event_registration_id
  );

-- Add the new unique constraint (per ticket per session) that matches the
-- proposed schema.  The old unique constraint on (event_registration_id,
-- check_in_session_id) is left in place until the clean-up migration.
create unique index if not exists check_ins_ticket_id_session_id_key
  on public.check_ins (ticket_id, check_in_session_id)
  where ticket_id is not null;


-- ── 6. event_seat_counts ──────────────────────────────────────────────────
--
-- Returns one row per requested event_id with:
--   tickets      – confirmed attendees (rows in event_tickets)
--   held_offers  – accepted applications whose offer has not expired and for
--                  whom no ticket exists yet (the seat is "held")
--   seats_left   – null when max_capacity is null; otherwise
--                  max_capacity - tickets - held_offers (floored at 0)
--
-- Security invoker so RLS on event_tickets/event_applications still applies.
-- Admins see all rows; regular users see only their own (not very useful for
-- a count, but consistent with the rest of the schema).

create or replace function public.event_seat_counts(p_event_ids uuid[])
returns table (
  event_id    uuid,
  tickets     bigint,
  held_offers bigint,
  seats_left  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with
  ticket_counts as (
    select t.event_id, count(*)::bigint as cnt
    from public.event_tickets t
    where t.event_id = any(p_event_ids)
    group by t.event_id
  ),
  held_offer_counts as (
    select a.event_id, count(*)::bigint as cnt
    from public.event_applications a
    where a.event_id = any(p_event_ids)
      and a.status = 'accepted'::public.application_status
      and a.offer_expires_at > now()
      and not exists (
            select 1
            from public.event_tickets t
            where t.event_id = a.event_id
              and t.user_id  = a.user_id
          )
    group by a.event_id
  )
  select
    e.id                                        as event_id,
    coalesce(tc.cnt, 0)                         as tickets,
    coalesce(hoc.cnt, 0)                        as held_offers,
    case
      when e.max_capacity is null then null
      else greatest(
             0,
             e.max_capacity
               - coalesce(tc.cnt, 0)
               - coalesce(hoc.cnt, 0)
           )::bigint
    end                                         as seats_left
  from public.events e
  left join ticket_counts       tc  on tc.event_id  = e.id
  left join held_offer_counts   hoc on hoc.event_id = e.id
  where e.id = any(p_event_ids);
$$;

comment on function public.event_seat_counts(uuid[]) is
  'Seat counts for many events in one call.  tickets = confirmed attendees; '
  'held_offers = accepted applications with an unexpired offer and no ticket yet; '
  'seats_left = max_capacity - tickets - held_offers (null when capacity is unlimited). '
  'Security invoker so RLS on event_tickets and event_applications applies to caller.';

revoke all on function public.event_seat_counts(uuid[])
  from public, anon;
grant execute on function public.event_seat_counts(uuid[])
  to authenticated, service_role;


-- ── 7. reserve_event_ticket ───────────────────────────────────────────────
--
-- Replaces reserve_paid_event_ticket.  Key differences:
--   • Inserts into event_tickets instead of event_registrations.
--   • Uses registration_opens_at / registration_closes_at (from migration 1).
--   • Uses requires_application (renamed from applications_enabled in migration 1).
--   • Seat count includes held offers via event_seat_counts.
--   • Returns ticket_id (not registration_id).
--
-- p_purchase_id is nullable so free tickets can be issued without a payment.

create or replace function public.reserve_event_ticket(
  p_event_id    uuid,
  p_user_id     uuid,
  p_purchase_id uuid default null
)
returns table (
  ticket_id      uuid,
  failure_reason text
)
language plpgsql
set search_path = ''
as $$
declare
  v_event          public.events%rowtype;
  v_existing_id    uuid;
  v_new_ticket_id  uuid;
  v_seats          record;
begin
  -- Lock the event row so concurrent calls for the same event serialize.
  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    return query select null::uuid, 'EVENT_NOT_FOUND'::text;
    return;
  end if;

  -- Idempotency: if this purchase already has a ticket, return it.
  if p_purchase_id is not null then
    select id
    into v_existing_id
    from public.event_tickets
    where purchase_id = p_purchase_id;

    if found then
      return query select v_existing_id, null::text;
      return;
    end if;
  end if;

  -- Check after idempotency lookup so that a retry on an already-reserved
  -- purchase succeeds even when the event is no longer active.
  if v_event.status <> 'active' then
    return query select null::uuid, 'EVENT_NOT_ACTIVE'::text;
    return;
  end if;

  -- An event that requires an application cannot be purchased directly.
  if v_event.requires_application and exists (
    select 1
    from public.event_application_questions
    where event_id = p_event_id
  ) then
    return query select null::uuid, 'APPLICATION_REQUIRED'::text;
    return;
  end if;

  -- Registration window checks.
  if v_event.registration_opens_at is not null
    and now() < v_event.registration_opens_at then
    return query select null::uuid, 'REGISTRATION_NOT_OPEN'::text;
    return;
  end if;

  if v_event.registration_closes_at is not null
    and now() > v_event.registration_closes_at then
    return query select null::uuid, 'REGISTRATION_CLOSED'::text;
    return;
  end if;

  -- Duplicate-ticket check.
  select id
  into v_existing_id
  from public.event_tickets
  where event_id = p_event_id
    and user_id  = p_user_id;

  if found then
    return query select v_existing_id, 'ALREADY_REGISTERED'::text;
    return;
  end if;

  -- Capacity check (includes held offers so the total is accurate).
  if v_event.max_capacity is not null then
    select *
    into v_seats
    from public.event_seat_counts(array[p_event_id])
    limit 1;

    if coalesce(v_seats.seats_left, 1) <= 0 then
      return query select null::uuid, 'SOLD_OUT'::text;
      return;
    end if;
  end if;

  -- All checks passed — issue the ticket.
  insert into public.event_tickets (
    event_id,
    user_id,
    purchase_id
  )
  values (
    p_event_id,
    p_user_id,
    p_purchase_id
  )
  returning id into v_new_ticket_id;

  return query select v_new_ticket_id, null::text;
end;
$$;

comment on function public.reserve_event_ticket(uuid, uuid, uuid) is
  'Atomically checks event state, registration window, seat availability '
  '(including held offers), and issues one ticket.  Pass p_purchase_id for '
  'paid tickets; omit it (or pass NULL) for free / admin-issued tickets.  '
  'Callable only by service_role.';

-- Restrict: callable only by service_role (mirrors reserve_paid_event_ticket
-- restriction from 20260923120000_restrict_paid_event_ticket_functions.sql).
revoke all on function public.reserve_event_ticket(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_event_ticket(uuid, uuid, uuid)
  to service_role;

