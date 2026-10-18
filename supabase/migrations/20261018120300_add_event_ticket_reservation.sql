-- Seat counts and ticket reservation over event_tickets and event_applications.
--
-- New functions beside reserve_paid_event_ticket and event_registration_counts,
-- which the deployed code keeps calling until it moves over.

-- Seats taken = tickets + accepted offers that haven't expired and have no
-- ticket yet (docs/event-states.md). Unfiltered, for service_role and the
-- functions below.
create function public.event_seat_counts_unfiltered(p_event_ids uuid[])
returns table (
  event_id    uuid,
  tickets     integer,
  held_offers integer,
  seats_left  integer
)
language sql stable set search_path = '' as $$
  select
    event.id,
    ticket_count.total,
    held_offer_count.total,
    greatest(0, event.max_capacity - ticket_count.total - held_offer_count.total)
  from public.events event
  cross join lateral (
    select count(*)::integer as total
    from public.event_tickets ticket
    where ticket.event_id = event.id
  ) ticket_count
  cross join lateral (
    select count(*)::integer as total
    from public.event_applications application
    where application.event_id = event.id
      and application.status = 'accepted'
      and application.offer_expires_at > now()
      and not exists (
        select 1
        from public.event_tickets ticket
        where ticket.event_id = application.event_id
          and ticket.user_id = application.user_id
      )
  ) held_offer_count
  where event.id = any(p_event_ids);
$$;

revoke all on function public.event_seat_counts_unfiltered(uuid[]) from public, anon, authenticated;
grant execute on function public.event_seat_counts_unfiltered(uuid[]) to service_role;

-- What browsers call. Counts every ticket and offer, which RLS would otherwise
-- narrow to the caller's own, but only for events the caller can see.
create function public.event_seat_counts(p_event_ids uuid[])
returns table (
  event_id    uuid,
  tickets     integer,
  held_offers integer,
  seats_left  integer
)
language sql stable security definer set search_path = '' as $$
  select counts.event_id, counts.tickets, counts.held_offers, counts.seats_left
  from public.event_seat_counts_unfiltered(p_event_ids) counts
  join public.events event on event.id = counts.event_id
  where public.event_is_public(event.status, event.publish_at)
     or public.is_admin();
$$;

revoke all on function public.event_seat_counts(uuid[]) from public;
grant execute on function public.event_seat_counts(uuid[]) to anon, authenticated, service_role;

-- Issues one ticket, or says why not. Pass p_purchase_id for a paid ticket and
-- leave it null for a free one. Order of checks:
--   1. a retried purchase gets its existing ticket back;
--   2. members can only register for public events; admins and managers can
--      also register for drafts and scheduled events, to test them;
--   3. one ticket per person;
--   4. an event that requires an application needs an accepted, unexpired
--      offer, whose seat is already held, so it skips the window and capacity;
--   5. otherwise the registration window and the seats left.
create function public.reserve_event_ticket(
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
  v_event        public.events%rowtype;
  v_is_staff     boolean;
  v_application  public.event_applications%rowtype;
  v_ticket_id    uuid;
  v_seats_left   integer;
begin
  -- Serializes reservations for one event.
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    return query select null::uuid, 'EVENT_NOT_FOUND'::text;
    return;
  end if;

  if p_purchase_id is not null then
    select id into v_ticket_id
    from public.event_tickets
    where purchase_id = p_purchase_id;

    if found then
      return query select v_ticket_id, null::text;
      return;
    end if;
  end if;

  select role_access in ('admin'::public.role_access_enum, 'manager'::public.role_access_enum)
  into v_is_staff
  from public.user_info
  where id = p_user_id
    and deleted_at is null;

  if not found then
    return query select null::uuid, 'USER_NOT_FOUND'::text;
    return;
  end if;

  if not v_is_staff and not public.event_is_public(v_event.status, v_event.publish_at) then
    return query select null::uuid, 'EVENT_NOT_ACTIVE'::text;
    return;
  end if;

  select id into v_ticket_id
  from public.event_tickets
  where event_id = p_event_id
    and user_id = p_user_id;

  if found then
    return query select v_ticket_id, 'ALREADY_REGISTERED'::text;
    return;
  end if;

  if v_event.requires_application then
    select * into v_application
    from public.event_applications
    where event_id = p_event_id
      and user_id = p_user_id;

    if not found or v_application.status <> 'accepted' then
      return query select null::uuid, 'APPLICATION_REQUIRED'::text;
      return;
    end if;

    if v_application.offer_expires_at <= now() then
      return query select null::uuid, 'OFFER_EXPIRED'::text;
      return;
    end if;
  else
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

    select counts.seats_left into v_seats_left
    from public.event_seat_counts_unfiltered(array[p_event_id]) counts;

    if v_seats_left <= 0 then
      return query select null::uuid, 'SOLD_OUT'::text;
      return;
    end if;
  end if;

  insert into public.event_tickets (event_id, user_id, purchase_id)
  values (p_event_id, p_user_id, p_purchase_id)
  returning id into v_ticket_id;

  return query select v_ticket_id, null::text;
end;
$$;

revoke all on function public.reserve_event_ticket(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_event_ticket(uuid, uuid, uuid) to service_role;
