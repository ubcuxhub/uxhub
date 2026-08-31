create or replace function public.reserve_paid_event_ticket(
    p_event_id uuid,
    p_user_id uuid,
    p_purchase_id uuid
)
returns table (
    registration_id uuid,
    failure_reason text
)
language plpgsql
as $$
declare
    v_event public.events%rowtype;
    v_existing_registration public.event_registrations%rowtype;
    v_registration_id uuid;
    v_occupied_count integer;
begin
    select *
    into v_event
    from public.events
    where id = p_event_id
    for update;

    if not found then
        return query select null::uuid, 'EVENT_NOT_FOUND'::text;
        return;
    end if;

    select *
    into v_existing_registration
    from public.event_registrations
    where purchase_id = p_purchase_id;

    if found then
        return query select v_existing_registration.id, null::text;
        return;
    end if;

    -- Checked here rather than only at checkout entry so an event archived
    -- while a payment is in flight cannot still take a seat: the row is locked
    -- above, so this reads the same state the reservation commits against.
    -- Runs after the purchase-id lookup so retrying an already-reserved
    -- purchase stays idempotent even once the event is archived.
    if v_event.status <> 'active' then
        return query select null::uuid, 'EVENT_NOT_ACTIVE'::text;
        return;
    end if;

    if v_event.applications_enabled and exists (
        select 1
        from public.event_application_questions
        where event_id = p_event_id
    ) then
        return query select null::uuid, 'APPLICATION_REQUIRED'::text;
        return;
    end if;

    if v_event.registration_start_time is not null
        and now() < v_event.registration_start_time then
        return query select null::uuid, 'REGISTRATION_NOT_OPEN'::text;
        return;
    end if;

    if v_event.registration_end_time is not null
        and now() > v_event.registration_end_time then
        return query select null::uuid, 'REGISTRATION_CLOSED'::text;
        return;
    end if;

    select *
    into v_existing_registration
    from public.event_registrations
    where event_id = p_event_id
      and user_id = p_user_id;

    if found then
        return query select v_existing_registration.id, 'ALREADY_REGISTERED'::text;
        return;
    end if;

    select count(*)
    into v_occupied_count
    from public.event_registrations
    where event_id = p_event_id
      and (
          purchase_id is not null
          or status = 'accepted'
          or coalesce(attending, false) = true
      );

    if v_occupied_count >= v_event.max_capacity then
        return query select null::uuid, 'SOLD_OUT'::text;
        return;
    end if;

    insert into public.event_registrations (
        event_id,
        user_id,
        status,
        attending,
        purchase_id
    )
    values (
        p_event_id,
        p_user_id,
        'pending',
        false,
        p_purchase_id
    )
    returning id into v_registration_id;

    return query select v_registration_id, null::text;
end;
$$;
