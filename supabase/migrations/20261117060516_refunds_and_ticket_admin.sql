-- Square refunds and admin ticket actions (docs/qr-check-in.md, "Which token"
-- and "Who gets a ticket"; docs/event-states.md, "Refunds").
--
-- 1. apply_event_purchase_refund records the amount Square has refunded on a
--    purchase. `purchases.status` keeps mirroring Square, so a refund is an
--    amount, never a status. A completed refund of the whole amount takes the
--    ticket back unless it has been checked in.
-- 2. A trigger refuses a ticket for a fully refunded purchase, so fulfillment
--    can never issue one after the refund landed.
-- 3. regenerate_event_ticket_token and void_event_ticket back the admin
--    check-in row menu.
--
-- Only new functions and one new trigger: nothing the deployed code calls
-- changes.

-- 1. Refunds ------------------------------------------------------------------

-- Records p_refunded_cents, the total of the purchase's COMPLETED Square
-- refunds, and acts on it. The recorded amount only ever goes up (capped at
-- the purchase amount), so a duplicate or out-of-order delivery changes
-- nothing. Under the event lock that reservation takes:
--   * an event ticket purchase refunded in full loses its ticket (and the
--     holder's team spot) through remove_event_ticket, unless the ticket has a
--     check-in, which keeps the ticket and its check-ins and says so in
--     kept_checked_in_ticket;
--   * a partial refund only records the amount;
--   * a membership purchase only records the amount: the membership stays.
-- Returns no row for an unknown purchase.
create function public.apply_event_purchase_refund(
  p_purchase_id uuid,
  p_refunded_cents integer
)
returns table (
  refunded_total_cents integer,
  fully_refunded boolean,
  amount_increased boolean,
  ticket_removed boolean,
  kept_checked_in_ticket boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_purchase public.purchases%rowtype;
  v_total integer;
  v_increased boolean := false;
  v_full boolean;
  v_ticket_id uuid;
  v_removed boolean := false;
  v_kept boolean := false;
begin
  if p_refunded_cents is null or p_refunded_cents < 0 then
    raise exception 'A refunded amount is zero or more cents.' using errcode = '22023';
  end if;

  select event_id into v_event_id from public.purchases where id = p_purchase_id;
  if not found then return; end if;
  -- The lock reservation and remove_event_ticket take, in the same order.
  if v_event_id is not null then
    perform 1 from public.events where id = v_event_id for update;
  end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then return; end if;

  v_total := least(p_refunded_cents, v_purchase.amount_cents);
  if v_total > v_purchase.refunded_cents then
    update public.purchases
    set refunded_cents = v_total, refunded_at = now()
    where id = p_purchase_id;
    v_increased := true;
  else
    v_total := v_purchase.refunded_cents;
  end if;

  v_full := v_purchase.amount_cents > 0 and v_total >= v_purchase.amount_cents;

  -- Runs on every delivery, not only the one that raised the amount, so a
  -- ticket issued in a race before the refund was recorded still goes.
  if v_full and v_purchase.kind = 'event_ticket' then
    select id into v_ticket_id from public.event_tickets where purchase_id = p_purchase_id;
    if found then
      if exists (
        select 1 from public.check_ins
        where ticket_id = v_ticket_id and checked_in_at is not null
      ) then
        v_kept := true;
      else
        v_removed := public.remove_event_ticket(v_ticket_id);
      end if;
    end if;
  end if;

  return query select v_total, v_full, v_increased, v_removed, v_kept;
end;
$$;

-- 2. No ticket for a refunded purchase ---------------------------------------

-- A payment confirmed by a late webhook can reach fulfillment after its
-- refund. The app checks first; this is the backstop for the race in between.
-- guard_event_ticket_configuration fires first (triggers run in name order)
-- and takes the event lock, which apply_event_purchase_refund also holds while
-- it records a refund, so this read sees any refund committed before it.
create function public.guard_refunded_purchase_ticket()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.purchase_id is not null and exists (
    select 1 from public.purchases
    where id = new.purchase_id
      and amount_cents > 0
      and refunded_cents >= amount_cents
  ) then
    raise exception 'This purchase was refunded, so it cannot hold a ticket.'
      using hint = 'PURCHASE_REFUNDED';
  end if;
  return new;
end;
$$;

create trigger guard_refunded_purchase_ticket
before insert or update of purchase_id on public.event_tickets
for each row execute function public.guard_refunded_purchase_ticket();

-- 3. Admin ticket actions -----------------------------------------------------

-- Gives a ticket a new QR code. The ticket, its holder, check-ins and team
-- stay; the old code, screenshots included, no longer matches any ticket.
-- Returns false when the ticket doesn't exist.
create function public.regenerate_event_ticket_token(p_ticket_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.event_tickets
  set qr_token = encode(extensions.gen_random_bytes(16), 'hex')
  where id = p_ticket_id;
  return found;
end;
$$;

-- Takes a ticket back: its seat and its holder's team spot are freed through
-- remove_event_ticket. Returns null on success, or why not:
--   TICKET_NOT_FOUND   no such ticket;
--   TICKET_CHECKED_IN  the ticket has a check-in (remove it first);
--   TICKET_PAID        the purchase holds or may still take money and has not
--                      been refunded in full, so the club would keep money
--                      for no ticket. Refund it in Square instead.
-- A $0 registration's purchase is marked canceled, so it no longer counts as
-- live (it never touched Square, so there is no status to mirror).
create function public.void_event_ticket(p_ticket_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_ticket public.event_tickets%rowtype;
  v_purchase public.purchases%rowtype;
begin
  select event_id into v_event_id from public.event_tickets where id = p_ticket_id;
  if not found then return 'TICKET_NOT_FOUND'; end if;
  perform 1 from public.events where id = v_event_id for update;
  select * into v_ticket from public.event_tickets where id = p_ticket_id for update;
  if not found then return 'TICKET_NOT_FOUND'; end if;

  if exists (
    select 1 from public.check_ins
    where ticket_id = p_ticket_id and checked_in_at is not null
  ) then
    return 'TICKET_CHECKED_IN';
  end if;

  if v_ticket.purchase_id is not null then
    select * into v_purchase from public.purchases where id = v_ticket.purchase_id for update;
    if found and v_purchase.amount_cents > 0 and public.purchase_is_live(v_purchase.id) then
      return 'TICKET_PAID';
    end if;
  end if;

  perform public.remove_event_ticket(p_ticket_id);

  if v_purchase.id is not null and v_purchase.amount_cents = 0 and v_purchase.status = 'completed' then
    update public.purchases
    set status = 'canceled', failure_reason = 'An admin voided this registration.'
    where id = v_purchase.id;
  end if;

  return null;
end;
$$;

-- Grants -----------------------------------------------------------------------

revoke all on function public.apply_event_purchase_refund(uuid, integer) from public, anon, authenticated;
revoke all on function public.guard_refunded_purchase_ticket() from public, anon, authenticated;
revoke all on function public.regenerate_event_ticket_token(uuid) from public, anon, authenticated;
revoke all on function public.void_event_ticket(uuid) from public, anon, authenticated;
grant execute on function public.apply_event_purchase_refund(uuid, integer) to service_role;
grant execute on function public.regenerate_event_ticket_token(uuid) to service_role;
grant execute on function public.void_event_ticket(uuid) to service_role;
