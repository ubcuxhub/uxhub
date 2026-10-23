-- Corrects event_applications from 20270101000003.
--
-- Its backfill turned every registration into an application, including
-- ticket purchases on events that take no applications, and gave accepted
-- ones an arbitrary now() + 30 days deadline. Nothing has written applications
-- since (the deployed code still uses event_registrations), so every row is a
-- backfilled copy: clear them, and 20270101000010 copies the right ones back.
-- event_application_responses.application_id cascades, so unlink responses
-- first or deleting an application deletes the member's answers.
--
-- Also adds what it left out: the allowed status moves, an insert policy that
-- checks the event, column grants in place of grant all to anon, and response
-- policies by application. 20270101000005 moved status to its own enum,
-- event_application_status.

update public.event_application_responses
set application_id = null
where application_id is not null;
delete from public.event_applications;

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

-- "applications: read own", "admins read all" and "admins update" from
-- 20270101000003 stand as they are. 20270101000005 dropped the insert policy.

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

-- Members choose only the event; admins only decide.
revoke all on table public.event_applications from anon, authenticated;
grant select on table public.event_applications to authenticated;
grant insert (event_id, user_id) on table public.event_applications to authenticated;
grant update (status, offer_expires_at) on table public.event_applications to authenticated;
grant all on table public.event_applications to service_role;

-- event_application_responses.application_id and its unique index come from
-- 20270101000003; event_registration_id stays required until the code writes
-- responses by application.

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
