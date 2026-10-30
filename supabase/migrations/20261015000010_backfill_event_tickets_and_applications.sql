-- Copies event_registrations into event_tickets and event_applications.
--
-- The deployed code keeps writing event_registrations after this runs, so the
-- function stays until the code moves over: the migration that ships with that
-- code calls it again first. It is safe to repeat. Tickets keep the
-- registration's id, so check-ins and responses link by copying it; a
-- re-run never touches an existing ticket and only refreshes an application
-- whose registration changed since.
--
-- What counts:
--   - a ticket is a registration with attending = true. A purchase_id alone is
--     a reservation still being paid for, or abandoned;
--   - an application is a registration on an event with applications_enabled
--     (docs/event-states.md: applications exist only for those events).
--     pending -> submitted, declined -> rejected, accepted -> accepted;
--   - every accepted application needs a deadline. Once it has a ticket the
--     value no longer matters, so it records when the registration last
--     changed. Without a ticket it is the event's registration close, else its
--     start, else now (expired).

create function public.backfill_event_tickets_and_applications()
returns void
language plpgsql set search_path = '' as $$
begin
  perform set_config('uxhub.skip_application_transition_check', 'on', true);

  insert into public.event_tickets (id, event_id, user_id, purchase_id, created_at, updated_at)
  select
    registration.id,
    registration.event_id,
    registration.user_id,
    registration.purchase_id,
    coalesce(registration.created_at, now()),
    coalesce(registration.updated_at, registration.created_at, now())
  from public.event_registrations registration
  where registration.attending is true
  on conflict do nothing;

  insert into public.event_applications (
    id, event_id, user_id, status, offer_expires_at, created_at, updated_at
  )
  select
    registration.id,
    registration.event_id,
    registration.user_id,
    case registration.status
      when 'accepted' then 'accepted'
      when 'declined' then 'rejected'
      else 'submitted'
    end::public.event_application_status,
    case
      when registration.status <> 'accepted' then null
      when registration.attending is true
        then coalesce(registration.updated_at, registration.created_at, now())
      else coalesce(event.registration_closes_at, event.starts_at, now())
    end,
    coalesce(registration.created_at, now()),
    coalesce(registration.updated_at, registration.created_at, now())
  from public.event_registrations registration
  join public.events event on event.id = registration.event_id
  where event.applications_enabled
  on conflict (event_id, user_id) do update
  set status = excluded.status,
      offer_expires_at = excluded.offer_expires_at
  where public.event_applications.updated_at < excluded.updated_at;

  update public.event_application_responses response
  set application_id = response.event_registration_id
  where response.application_id is null
    and exists (
      select 1
      from public.event_applications application
      where application.id = response.event_registration_id
    );

  update public.check_ins check_in
  set ticket_id = check_in.event_registration_id
  where check_in.ticket_id is null
    and exists (
      select 1
      from public.event_tickets ticket
      where ticket.id = check_in.event_registration_id
    );

  perform set_config('uxhub.skip_application_transition_check', 'off', true);
end;
$$;

revoke all on function public.backfill_event_tickets_and_applications() from public, anon, authenticated;
grant execute on function public.backfill_event_tickets_and_applications() to service_role;

select public.backfill_event_tickets_and_applications();
