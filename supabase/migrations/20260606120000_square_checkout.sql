alter table public.user_info
add column square_customer_id text;

create table public.purchases (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_info(id) on delete cascade,
    kind text not null check (kind in ('event_ticket', 'membership')),
    status text not null check (status in ('pending', 'authorized', 'completed', 'canceled', 'failed')),
    amount_cents bigint not null check (amount_cents >= 0),
    currency text not null check (char_length(currency) = 3),
    event_id uuid references public.events(id) on delete restrict,
    membership_type_id uuid references public.membership_types(id) on delete restrict,
    square_payment_id text unique,
    square_customer_id text,
    idempotency_key text not null unique,
    failure_reason text,
    fulfilled_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    check (
        (kind = 'event_ticket' and event_id is not null and membership_type_id is null)
        or
        (kind = 'membership' and membership_type_id is not null and event_id is null)
    )
);

create table public.square_webhook_events (
    event_id text primary key,
    event_type text not null,
    payload jsonb not null,
    processed_at timestamp with time zone default now(),
    created_at timestamp with time zone default now()
);

alter table public.event_registrations
add column purchase_id uuid references public.purchases(id) on delete set null;

create index idx_purchases_user_id on public.purchases(user_id);
create index idx_purchases_event_id on public.purchases(event_id);
create index idx_purchases_membership_type_id on public.purchases(membership_type_id);
create index idx_purchases_status on public.purchases(status);
create unique index idx_event_registrations_purchase_id
    on public.event_registrations(purchase_id)
    where purchase_id is not null;

create trigger update_purchases_updated_at
before update on public.purchases
for each row execute function public.update_updated_at_column();

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

    if exists (
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

create or replace function public.release_paid_event_ticket_reservation(
    p_purchase_id uuid
)
returns void
language sql
as $$
    delete from public.event_registrations
    where purchase_id = p_purchase_id
      and status = 'pending'
      and coalesce(attending, false) = false;
$$;

alter table public.purchases enable row level security;
alter table public.square_webhook_events enable row level security;

create policy "user can select own purchases"
    on public.purchases for select to authenticated
    using (
        exists (
            select 1
            from public.user_info
            where user_info.id = purchases.user_id
              and user_info.auth_user_id = auth.uid()
        )
    );

grant all on table public.purchases to anon;
grant all on table public.purchases to authenticated;
grant all on table public.purchases to service_role;
grant all on table public.square_webhook_events to service_role;
grant execute on function public.reserve_paid_event_ticket(uuid, uuid, uuid) to service_role;
grant execute on function public.release_paid_event_ticket_reservation(uuid) to service_role;
