-- Activate declared Free/Paid settings; keep legacy callers compatible during
-- deployment. No historical purchase amounts or unrelated membership data change.
alter table public.events drop constraint events_pricing_policy_check;
alter table public.events add constraint events_pricing_policy_check
  check (pricing_policy in ('legacy', 'figma_pending', 'figma'));

create or replace function public.guard_event_builder_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Normalize configured pricing before comparing locks. Existing callers that
  -- omit configuration retain their original legacy amounts.
  if new.configured_pricing_mode is not null and
    (tg_op = 'INSERT' or old.pricing_policy <> 'legacy' or
     (new.configured_pricing_mode, new.configured_price) is distinct from
     (old.configured_pricing_mode, old.configured_price)) then
    new.pricing_policy := 'figma';
    new.regular_price := new.configured_price;
    new.member_price := 0;
  elsif new.configured_pricing_mode is null and new.pricing_policy <> 'legacy' then
    raise exception 'Configured pricing is required.';
  end if;
  if tg_op = 'UPDATE' then
    if old.pricing_policy = 'figma' and new.pricing_policy <> 'figma' then
      raise exception 'Configured pricing cannot be removed.';
    end if;
    if old.first_published_at is not null and
      (new.slug is distinct from old.slug or new.configured_slug is distinct from old.configured_slug) then
      -- Initializing the saved configuration with the existing URL is safe.
      if not (old.configured_slug is null and new.configured_slug = old.slug and new.slug is not distinct from old.slug) then
        raise exception 'The page URL is locked after first publication.';
      end if;
    end if;
    new.first_published_at := old.first_published_at;
    if (new.regular_price, new.member_price, new.configured_pricing_mode, new.configured_price)
      is distinct from (old.regular_price, old.member_price, old.configured_pricing_mode, old.configured_price)
      and public.admin_event_pricing_locked(old.id) then
      raise exception 'Pricing is locked because registrations or payments exist.';
    end if;
  end if;
  if new.status <> 'draft' and new.first_published_at is null then new.first_published_at := now(); end if;
  if new.configured_slug is not null and
    (length(new.configured_slug) > 100 or new.configured_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or
     new.configured_slug in ('new','create','create-new','admin','api','auth','portal','events','drafts','dev','settings')) then
    raise exception 'Use a valid, non-reserved page URL of at most 100 characters.';
  end if;
  return new;
end;
$$;

-- Shared authoritative quote, including old deployments still inserting paid
-- purchases directly while the new build is becoming available.
create function public.event_checkout_amount(p_event_id uuid, p_user_id uuid)
returns bigint language sql stable set search_path = '' as $$
  select round(100 * case when e.pricing_policy = 'figma' then
    case when u.membership_type_id is not null
      and (u.membership_expires_at is null or u.membership_expires_at > now())
      and (s.membership_term_ends_at is null or s.membership_term_ends_at > now())
      then 0 else e.regular_price end
    else case when u.membership_type_id is not null then e.member_price else e.regular_price end end)::bigint
  from public.events e join public.user_info u on u.id = p_user_id and u.deleted_at is null
  left join public.app_settings s on true where e.id = p_event_id;
$$;
revoke all on function public.event_checkout_amount(uuid,uuid) from public,anon,authenticated;
grant execute on function public.event_checkout_amount(uuid,uuid) to service_role;

-- Keep the shared event lock used by ticket/offer/payment writes. Only the
-- temporary integration refusal is removed.
create or replace function public.guard_event_checkout_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_policy text;
begin
  if new.event_id is not null then
    select pricing_policy into v_policy from public.events where id = new.event_id for update;
    if tg_table_name = 'purchases' and v_policy = 'figma' then
      if new.amount_cents is distinct from public.event_checkout_amount(new.event_id,new.user_id) then
        raise exception 'Ticket price has changed. Refresh checkout.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Pending drafts have no purchases (the previous guard prohibited them).
-- Older legacy records adopt declared configuration only on an explicit save.
update public.events set pricing_policy = 'figma'
where pricing_policy = 'figma_pending';

-- One transaction owns the price snapshot and purchase initialization. Free
-- registrations reserve and complete in this same transaction, so no crash can
-- strand a zero-price pending purchase or consume a seat without a receipt.
create function public.initialize_event_checkout(
  p_event_id uuid, p_user_id uuid, p_idempotency_key text,
  p_free_only boolean default false, p_expected_amount_cents bigint default null
) returns table(purchase_id uuid, amount_cents bigint, failure_reason text, created boolean)
language plpgsql set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_user public.user_info%rowtype;
  v_purchase public.purchases%rowtype;
  v_amount bigint;
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
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    return query select null::uuid, null::bigint, 'EVENT_NOT_FOUND'::text, false; return;
  end if;
  select * into v_user from public.user_info where id = p_user_id and deleted_at is null;
  if not found then
    return query select null::uuid, null::bigint, 'USER_NOT_FOUND'::text, false; return;
  end if;
  if v_user.role_access not in ('admin', 'manager') and not public.event_is_public(v_event.status, v_event.publish_at) then
    return query select null::uuid, null::bigint, 'EVENT_NOT_ACTIVE'::text, false; return;
  end if;
  v_amount := public.event_checkout_amount(p_event_id,p_user_id);
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
revoke all on function public.initialize_event_checkout(uuid,uuid,text,boolean,bigint) from public,anon,authenticated;
grant execute on function public.initialize_event_checkout(uuid,uuid,text,boolean,bigint) to service_role;
