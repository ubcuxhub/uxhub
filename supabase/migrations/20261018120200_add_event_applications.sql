-- event_applications from docs/schema-proposed.sql, and
-- event_application_responses.application_id.
--
-- Additive only. The existing application_status enum stays as it is, since
-- event_registrations and the deployed code still use pending/declined/accepted.
-- Applications get their own enum, event_application_status, under a name that
-- never has to change; application_status is dropped with event_registrations.

create type public.event_application_status as enum (
  'submitted',
  'accepted',
  'rejected',
  'waitlisted'
);

create table public.event_applications (
  id               uuid        not null default gen_random_uuid(),
  event_id         uuid        not null,
  user_id          uuid        not null,
  status           public.event_application_status not null default 'submitted',
  offer_expires_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint event_applications_pkey primary key (id),
  constraint event_applications_event_id_fkey
    foreign key (event_id) references public.events (id) on delete cascade,
  constraint event_applications_user_id_fkey
    foreign key (user_id) references public.user_info (id),
  constraint event_applications_event_id_user_id_key unique (event_id, user_id),
  constraint event_applications_accepted_requires_deadline
    check (status <> 'accepted' or offer_expires_at is not null)
);

create index event_applications_user_id_idx on public.event_applications (user_id);

create trigger update_event_applications_updated_at
before update on public.event_applications
for each row execute function public.update_updated_at_column();

-- The moves docs/event-states.md allows. Re-offering keeps accepted with a new
-- deadline; an offer can be taken back only before the person registers.
-- backfill_event_tickets_and_applications() mirrors legacy decisions as they
-- are, so it sets uxhub.skip_application_transition_check for its transaction.
create function public.check_event_application_transition()
returns trigger
language plpgsql set search_path = '' as $$
declare
  v_allowed boolean;
begin
  if current_setting('uxhub.skip_application_transition_check', true) = 'on' then
    return new;
  end if;

  if new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'An application cannot move to another event or person.'
      using errcode = 'check_violation';
  end if;

  v_allowed := case old.status
    when 'submitted' then true
    when 'waitlisted' then new.status in ('waitlisted', 'accepted', 'rejected')
    when 'accepted' then new.status in ('accepted', 'rejected')
    when 'rejected' then new.status = 'rejected'
  end;

  if not v_allowed then
    raise exception 'An application cannot go from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if old.status = 'accepted' and new.status = 'rejected' and exists (
    select 1
    from public.event_tickets ticket
    where ticket.event_id = new.event_id
      and ticket.user_id = new.user_id
  ) then
    raise exception 'This applicant already has a ticket, so the offer cannot be taken back.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.check_event_application_transition() from public, anon, authenticated;

create trigger check_event_application_transition
before update on public.event_applications
for each row execute function public.check_event_application_transition();

alter table public.event_applications enable row level security;

create policy "applications: read own"
on public.event_applications
for select
to authenticated
using (user_id = public.current_user_info_id());

create policy "applications: admins read all"
on public.event_applications
for select
to authenticated
using (public.is_admin());

-- A member applies for themself, to an event that takes applications, while
-- its registration is open. Drafts and scheduled events take applications only
-- from admins and managers.
create policy "applications: insert own"
on public.event_applications
for insert
to authenticated
with check (
  user_id = public.current_user_info_id()
  and status = 'submitted'
  and offer_expires_at is null
  and exists (
    select 1
    from public.events event
    where event.id = event_applications.event_id
      and event.requires_application
      and (public.event_is_public(event.status, event.publish_at) or public.is_admin())
      and (event.registration_opens_at is null or now() >= event.registration_opens_at)
      and (event.registration_closes_at is null or now() <= event.registration_closes_at)
  )
);

create policy "applications: admins update"
on public.event_applications
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Members choose only the event; admins only decide.
revoke all on table public.event_applications from anon, authenticated;
grant select on table public.event_applications to authenticated;
grant insert (event_id, user_id) on table public.event_applications to authenticated;
grant update (status, offer_expires_at) on table public.event_applications to authenticated;
grant all on table public.event_applications to service_role;

-- Filled for responses of backfilled applications. event_registration_id
-- stays required until the code writes responses by application.
alter table public.event_application_responses
  add column application_id uuid references public.event_applications (id) on delete cascade,
  add constraint event_application_responses_question_id_application_id_key
    unique (event_application_question_id, application_id);

create policy "application responses: read own application"
on public.event_application_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.event_applications application
    where application.id = event_application_responses.application_id
      and application.user_id = public.current_user_info_id()
  )
);

create policy "application responses: insert own application"
on public.event_application_responses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.event_applications application
    where application.id = event_application_responses.application_id
      and application.user_id = public.current_user_info_id()
  )
);

create policy "application responses: update own application"
on public.event_application_responses
for update
to authenticated
using (
  exists (
    select 1
    from public.event_applications application
    where application.id = event_application_responses.application_id
      and application.user_id = public.current_user_info_id()
  )
)
with check (
  exists (
    select 1
    from public.event_applications application
    where application.id = event_application_responses.application_id
      and application.user_id = public.current_user_info_id()
  )
);

create policy "application responses: delete own application"
on public.event_application_responses
for delete
to authenticated
using (
  exists (
    select 1
    from public.event_applications application
    where application.id = event_application_responses.application_id
      and application.user_id = public.current_user_info_id()
  )
);
