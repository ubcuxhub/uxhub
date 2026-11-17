-- Ticket-safety groundwork (docs/event-states.md, "Live purchases").
--
-- 1. Columns later pull requests build on: an event cancellation flag and a
--    purchase's refunded amount. Nothing writes them yet.
-- 2. One definition of a live purchase, used by the pricing lock, the
--    registration-mode lock and event deletion in place of `status <> 'failed'`,
--    so a canceled attempt no longer locks an event for good.
-- 3. Ticket eligibility (status, cancellation, window, offer and seats) in one
--    function, which checkout now runs before it inserts a purchase or touches
--    Square, so a doomed paid attempt never places a hold on a card.
-- 4. Staff test registration on drafts is free events only.
-- 5. Deletion is allowed when no member is affected, and removes the event's
--    dead purchases first (`purchases.event_id` is `on delete restrict`).
--
-- Backward compatible with the deployed code: every function keeps its
-- signature, and refusals reuse existing codes except EVENT_CANCELED, which no
-- event can produce until a later release sets `canceled_at`.

-- 1. Columns ------------------------------------------------------------------

-- Cancel is a flag on an active event, not a new status value.
alter table public.events
  add column canceled_at timestamptz,
  add column cancellation_note text;

-- Square owns `purchases.status`, so a refund is an amount, never a status.
alter table public.purchases
  add column refunded_cents integer not null default 0,
  add column refunded_at timestamptz,
  add constraint purchases_refunded_cents_check
    check (refunded_cents >= 0 and refunded_cents <= amount_cents);

-- 2. Live purchases -----------------------------------------------------------

-- A purchase is live while it holds or may still take money, or records a
-- registration somebody relies on:
--   * pending or authorized (Square may still capture it);
--   * completed and not fully refunded;
--   * completed for $0 (a free registration), except a staff member's test
--     registration on an event that is still a draft.
-- Failed and canceled attempts are dead, as are fully refunded purchases.
-- These helpers stay volatile, like admin_event_pricing_locked
-- (20261112231339): a check made after waiting on the event lock must see
-- rows that committed meanwhile.
create function public.purchase_is_live(p_purchase_id uuid)
returns boolean
language sql security definer set search_path = '' as $$
  select p.status in ('pending', 'authorized')
    or (p.status = 'completed' and case
      when p.amount_cents > 0 then p.refunded_cents < p.amount_cents
      else not coalesce(
        e.status = 'draft'::public.event_status
          and u.role_access in ('admin'::public.role_access_enum, 'manager'::public.role_access_enum),
        false)
    end)
  from public.purchases p
  left join public.events e on e.id = p.event_id
  left join public.user_info u on u.id = p.user_id
  where p.id = p_purchase_id;
$$;

create function public.event_has_live_purchases(p_event_id uuid)
returns boolean
language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.purchases p
    where p.event_id = p_event_id and public.purchase_is_live(p.id)
  );
$$;

-- What deleting an event would take from members: non-staff, non-deleted
-- accounts with a ticket, a held offer (accepted, unexpired, no ticket yet: a
-- seat, as in event_seat_counts) or a payment in flight.
create function public.event_member_commitments(p_event_id uuid)
returns table (tickets integer, offers integer, pending_purchases integer)
language sql security definer set search_path = '' as $$
  with members as (
    select u.id from public.user_info u
    where u.deleted_at is null
      and not coalesce(u.role_access in ('admin'::public.role_access_enum, 'manager'::public.role_access_enum), false)
  )
  select
    (select count(*)::integer from public.event_tickets t
      where t.event_id = p_event_id and t.user_id in (select id from members)),
    (select count(*)::integer from public.event_applications a
      where a.event_id = p_event_id and a.status = 'accepted' and a.offer_expires_at > now()
        and a.user_id in (select id from members)
        and not exists (select 1 from public.event_tickets t where t.event_id = a.event_id and t.user_id = a.user_id)),
    (select count(*)::integer from public.purchases p
      where p.event_id = p_event_id and p.status in ('pending', 'authorized')
        and p.user_id in (select id from members));
$$;

-- 3. Removing one ticket ------------------------------------------------------

-- Deletes a ticket (its check-ins cascade) and frees its holder's team spot on
-- that event the way account deletion does (free_team_spots_of_deleted_user):
-- a team they owned passes to the teammate who joined first, or is deleted if
-- nobody else is on it. The purchase is left for the caller. Returns false
-- when the ticket doesn't exist.
create function public.remove_event_ticket(p_ticket_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_user_id uuid;
begin
  select event_id into v_event_id from public.event_tickets where id = p_ticket_id;
  if not found then return false; end if;
  -- The event lock that reservation and team writes take.
  perform 1 from public.events where id = v_event_id for update;
  select user_id into v_user_id from public.event_tickets where id = p_ticket_id for update;
  if not found then return false; end if;

  delete from public.teams team
  where team.event_id = v_event_id
    and team.owner_id = v_user_id
    and not exists (
      select 1 from public.team_members member
      where member.team_id = team.id and member.user_id <> v_user_id
    );

  update public.teams team
  set owner_id = (
    select member.user_id from public.team_members member
    where member.team_id = team.id and member.user_id <> v_user_id
    order by member.joined_at, member.user_id
    limit 1
  )
  where team.event_id = v_event_id and team.owner_id = v_user_id;

  delete from public.team_members where event_id = v_event_id and user_id = v_user_id;
  delete from public.event_tickets where id = p_ticket_id;
  return true;
end;
$$;

-- 4. Eligibility --------------------------------------------------------------

-- Why this person can't get a ticket at this amount, or null when they can.
-- The caller holds the event row lock. Order:
--   1. the event and the account exist;
--   2. a canceled event takes no registrations (EVENT_CANCELED);
--   3. members register only for public events; admins and managers may also
--      test-register on a draft or scheduled event, but only a free one at $0;
--   4. an application event needs an accepted, unexpired offer, whose seat is
--      already held, so it skips the window and capacity;
--   5. otherwise the registration window and the seats left.
-- One ticket per person is the caller's check: reservation returns the
-- existing ticket with ALREADY_REGISTERED.
create function public.event_ticket_eligibility(
  p_event_id uuid,
  p_user_id uuid,
  p_amount_cents bigint default 0
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_is_staff boolean;
  v_application public.event_applications%rowtype;
  v_seats_left integer;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then return 'EVENT_NOT_FOUND'; end if;

  select role_access in ('admin'::public.role_access_enum, 'manager'::public.role_access_enum)
  into v_is_staff
  from public.user_info where id = p_user_id and deleted_at is null;
  if not found then return 'USER_NOT_FOUND'; end if;

  if v_event.canceled_at is not null then return 'EVENT_CANCELED'; end if;

  if not public.event_is_public(v_event.status, v_event.publish_at) then
    if not coalesce(v_is_staff, false)
       or p_amount_cents is distinct from 0
       or v_event.regular_price is distinct from 0
       or coalesce(v_event.member_price, 0) <> 0 then
      return 'EVENT_NOT_ACTIVE';
    end if;
  end if;

  if v_event.requires_application then
    select * into v_application from public.event_applications
    where event_id = p_event_id and user_id = p_user_id;
    if not found or v_application.status <> 'accepted' then return 'APPLICATION_REQUIRED'; end if;
    if v_application.offer_expires_at <= now() then return 'OFFER_EXPIRED'; end if;
    return null;
  end if;

  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    return 'REGISTRATION_NOT_OPEN';
  end if;
  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    return 'REGISTRATION_CLOSED';
  end if;

  select counts.seats_left into v_seats_left
  from public.event_seat_counts_unfiltered(array[p_event_id]) counts;
  if v_seats_left <= 0 then return 'SOLD_OUT'; end if;

  return null;
end;
$$;

-- Issues one ticket, or says why not. Pass p_purchase_id for a purchased
-- ticket (its amount decides draft eligibility) and leave it null for a free
-- one. A retried purchase gets its existing ticket back, and a second ticket
-- for the same person returns the first with ALREADY_REGISTERED; everything
-- else is event_ticket_eligibility.
create or replace function public.reserve_event_ticket(
  p_event_id    uuid,
  p_user_id     uuid,
  p_purchase_id uuid default null
)
returns table (
  ticket_id      uuid,
  failure_reason text
)
language plpgsql set search_path = '' as $$
declare
  v_ticket_id uuid;
  v_amount bigint := 0;
  v_failure text;
begin
  -- Serializes reservations for one event.
  perform 1 from public.events where id = p_event_id for update;
  if not found then
    return query select null::uuid, 'EVENT_NOT_FOUND'::text;
    return;
  end if;

  if p_purchase_id is not null then
    select id into v_ticket_id from public.event_tickets where purchase_id = p_purchase_id;
    if found then
      return query select v_ticket_id, null::text;
      return;
    end if;
    -- Null for an unknown purchase, which no draft accepts.
    v_amount := (select amount_cents from public.purchases where id = p_purchase_id);
  end if;

  select id into v_ticket_id from public.event_tickets
  where event_id = p_event_id and user_id = p_user_id;
  if found then
    return query select v_ticket_id, 'ALREADY_REGISTERED'::text;
    return;
  end if;

  v_failure := public.event_ticket_eligibility(p_event_id, p_user_id, v_amount);
  if v_failure is not null then
    return query select null::uuid, v_failure;
    return;
  end if;

  insert into public.event_tickets (event_id, user_id, purchase_id)
  values (p_event_id, p_user_id, p_purchase_id)
  returning id into v_ticket_id;

  return query select v_ticket_id, null::text;
end;
$$;

-- Same contract as 20261112231351. Eligibility now runs before the purchase
-- is inserted, so a refused attempt leaves no purchase and the app never
-- reaches Square for it. The free path still reserves and completes in this
-- transaction.
create or replace function public.initialize_event_checkout(
  p_event_id uuid, p_user_id uuid, p_idempotency_key text,
  p_free_only boolean default false, p_expected_amount_cents bigint default null
) returns table(purchase_id uuid, amount_cents bigint, failure_reason text, created boolean)
language plpgsql set search_path = '' as $$
declare
  v_purchase public.purchases%rowtype;
  v_amount bigint;
  v_failure text;
  v_reservation record;
begin
  -- Serializes equal keys even when callers supply different event identities.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_purchase from public.purchases where idempotency_key = p_idempotency_key;
  if found then
    if v_purchase.user_id <> p_user_id or v_purchase.event_id is distinct from p_event_id
       or v_purchase.kind <> 'event_ticket' then
      return query select null::uuid, null::bigint, 'ATTEMPT_MISMATCH'::text, false;
    elsif (p_free_only and v_purchase.amount_cents <> 0) or
      (p_expected_amount_cents is not null and p_expected_amount_cents <> v_purchase.amount_cents) then
      return query select null::uuid, v_purchase.amount_cents, 'PRICE_CHANGED'::text, false;
    else
      return query select v_purchase.id, v_purchase.amount_cents, null::text, false;
    end if;
    return;
  end if;
  perform 1 from public.events where id = p_event_id for update;
  if not found then
    return query select null::uuid, null::bigint, 'EVENT_NOT_FOUND'::text, false; return;
  end if;
  perform 1 from public.user_info where id = p_user_id and deleted_at is null;
  if not found then
    return query select null::uuid, null::bigint, 'USER_NOT_FOUND'::text, false; return;
  end if;
  v_amount := public.event_checkout_amount(p_event_id, p_user_id);
  v_failure := public.event_ticket_eligibility(p_event_id, p_user_id, v_amount);
  if v_failure is null and exists (
    select 1 from public.event_tickets where event_id = p_event_id and user_id = p_user_id
  ) then
    v_failure := 'ALREADY_REGISTERED';
  end if;
  if v_failure is not null then
    return query select null::uuid, v_amount, v_failure, false; return;
  end if;
  if (p_expected_amount_cents is not null and v_amount <> p_expected_amount_cents)
     or (p_free_only and v_amount <> 0) then
    return query select null::uuid, v_amount, 'PRICE_CHANGED'::text, false; return;
  end if;
  insert into public.purchases(user_id, event_id, kind, amount_cents, currency, idempotency_key, status)
  values(p_user_id, p_event_id, 'event_ticket', v_amount, 'CAD', p_idempotency_key, 'pending')
  returning * into v_purchase;
  if v_amount = 0 then
    select * into v_reservation from public.reserve_event_ticket(p_event_id, p_user_id, v_purchase.id);
    if v_reservation.failure_reason is not null or v_reservation.ticket_id is null then
      delete from public.purchases where id = v_purchase.id;
      return query select null::uuid, v_amount, coalesce(v_reservation.failure_reason, 'RESERVATION_FAILED')::text, false;
      return;
    end if;
    update public.purchases set status = 'completed', fulfilled_at = now() where id = v_purchase.id;
  end if;
  return query select v_purchase.id, v_amount, null::text, true;
end;
$$;

-- 5. Locks use live purchases ------------------------------------------------

create or replace function public.admin_event_pricing_locked(p_event_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then raise exception 'Staff access required.'; end if;
  return exists(select 1 from public.event_tickets where event_id = p_event_id)
    or exists(select 1 from public.event_applications where event_id = p_event_id and status = 'accepted' and offer_expires_at > now())
    or public.event_has_live_purchases(p_event_id);
end;
$$;

-- As in 20261115024039, with live purchases in the registration-mode lock.
CREATE OR REPLACE FUNCTION public.guard_event_registration_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_floor integer; v_dates jsonb; v_start timestamptz; v_end timestamptz; v_document jsonb; v_location jsonb;
begin
  if new.registration_opens_at is not null and new.registration_closes_at is not null
    and new.registration_opens_at >= new.registration_closes_at then
    raise exception 'Registration end time must be after the start time.' using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  if tg_op = 'UPDATE' then
    if new.requires_application is distinct from old.requires_application and (
      exists(select 1 from public.event_tickets where event_id = old.id)
      or exists(select 1 from public.event_applications where event_id = old.id and status <> 'draft')
      or public.event_has_live_purchases(old.id)
    ) then
      raise exception 'Registration mode is locked because registrations or payments exist.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    if new.max_capacity is distinct from old.max_capacity then
      select tickets + held_offers into v_floor from public.event_seat_counts_unfiltered(array[old.id]);
      if (new.max_capacity is null and v_floor > 0) or new.max_capacity < v_floor then
        raise exception 'Capacity cannot be below % committed seats (tickets and held offers).', v_floor using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
    end if;
    select document into v_document from public.event_date_location_settings where event_id = old.id;
    v_dates := v_document->'dates';
    if v_dates is not null and new.working_document is null then
      select min((row->>'start_time')::timestamptz), max((row->>'end_time')::timestamptz)
      into v_start, v_end from jsonb_array_elements(v_dates) row;
      v_location := v_document->'location';
      new.location_type := (v_location->>'type')::public.event_location_type;
      new.location_building := case when v_document->>'audience' = 'going' then v_location->>'public_summary' when v_location->>'type' = 'online' then 'Online' else v_location->>'building' end;
      new.location_room := case when v_document->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'room', '') end;
      new.location_address := case when v_document->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'address', '') end;
      new.location_address_url := case when v_document->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'map_url', '') end;
      if new.starts_at is distinct from v_start or new.ends_at is distinct from v_end then
        raise exception 'Edit individual event dates in the event form.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
    end if;
  end if;
  return new;
end $function$;

-- 6. Deletion ----------------------------------------------------------------

-- Called by delete_event_atomically, which already holds the event row lock.
-- Refuses while a member is affected or any purchase is live, then removes
-- the dead purchases (failed, canceled, fully refunded, staff $0 tests on a
-- draft) that would otherwise restrict the delete. Tickets, teams,
-- applications and check-ins cascade.
create or replace function public.delete_event_before_safe_mutations(target_event_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_commitments record;
begin
  -- Hold the purchases so none turns live between the check and the delete.
  perform 1 from public.purchases where event_id = target_event_id for update;

  select * into v_commitments from public.event_member_commitments(target_event_id);
  if v_commitments.tickets > 0 or v_commitments.offers > 0 or v_commitments.pending_purchases > 0 then
    raise exception 'Unable to delete the event because members are registered, hold offers or have payments in progress.'
      using hint = 'EVENT_DELETE_PROTECTED';
  end if;

  if public.event_has_live_purchases(target_event_id) then
    raise exception 'Unable to delete the event because it has purchases that are not failed, canceled or refunded.'
      using hint = 'EVENT_DELETE_PROTECTED';
  end if;

  delete from public.purchases p
  where p.event_id = target_event_id and not public.purchase_is_live(p.id);

  delete from public.events where id = target_event_id;
end;
$$;

-- 7. Grants ------------------------------------------------------------------

revoke all on function public.purchase_is_live(uuid) from public, anon, authenticated;
revoke all on function public.event_has_live_purchases(uuid) from public, anon, authenticated;
revoke all on function public.event_member_commitments(uuid) from public, anon, authenticated;
revoke all on function public.remove_event_ticket(uuid) from public, anon, authenticated;
revoke all on function public.event_ticket_eligibility(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.delete_event_before_safe_mutations(uuid) from public, anon, authenticated;
grant execute on function public.purchase_is_live(uuid) to service_role;
grant execute on function public.event_has_live_purchases(uuid) to service_role;
grant execute on function public.event_member_commitments(uuid) to service_role;
grant execute on function public.remove_event_ticket(uuid) to service_role;
grant execute on function public.event_ticket_eligibility(uuid, uuid, bigint) to service_role;
