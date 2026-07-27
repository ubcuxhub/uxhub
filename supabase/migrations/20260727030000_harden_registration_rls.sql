drop policy if exists "user can select event registrations" on public.event_registrations;
drop policy if exists "user can insert event registrations" on public.event_registrations;
drop policy if exists "user can update event registrations" on public.event_registrations;
drop policy if exists "user can delete event registrations" on public.event_registrations;

create policy "registrations: read own"
  on public.event_registrations
  for select
  to authenticated
  using (user_id = public.current_user_info_id());

create policy "registrations: admins read all"
  on public.event_registrations
  for select
  to authenticated
  using (public.is_admin());

create policy "registrations: insert own pending"
  on public.event_registrations
  for insert
  to authenticated
  with check (
    user_id = public.current_user_info_id()
    and status = 'pending'::public.application_status
    and attending is not true
    and purchase_id is null
  );

create policy "registrations: admins update"
  on public.event_registrations
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Enable insert for authenticated users only" on public.event_application_responses;
drop policy if exists "Enable read access for all users" on public.event_application_responses;
drop policy if exists "Users can delete their applications" on public.event_application_responses;
drop policy if exists "Users can update their application" on public.event_application_responses;

create policy "application responses: read own"
  on public.event_application_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_registrations registration
      where registration.id = event_registration_id
        and registration.user_id = public.current_user_info_id()
    )
  );

create policy "application responses: admins read all"
  on public.event_application_responses
  for select
  to authenticated
  using (public.is_admin());

create policy "application responses: insert own"
  on public.event_application_responses
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.event_registrations registration
      where registration.id = event_registration_id
        and registration.user_id = public.current_user_info_id()
    )
  );

create policy "application responses: update own"
  on public.event_application_responses
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.event_registrations registration
      where registration.id = event_registration_id
        and registration.user_id = public.current_user_info_id()
    )
  )
  with check (
    exists (
      select 1
      from public.event_registrations registration
      where registration.id = event_registration_id
        and registration.user_id = public.current_user_info_id()
    )
  );

create policy "application responses: delete own"
  on public.event_application_responses
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.event_registrations registration
      where registration.id = event_registration_id
        and registration.user_id = public.current_user_info_id()
    )
  );

drop policy if exists "Authenticated users can view check-in sessions" on public.check_in_sessions;
drop policy if exists "Admins can insert check-in sessions" on public.check_in_sessions;
drop policy if exists "Admins can update check-in sessions" on public.check_in_sessions;
drop policy if exists "Admins can delete check-in sessions" on public.check_in_sessions;

create policy "check-in sessions: registered users read"
  on public.check_in_sessions
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.event_registrations registration
      where registration.event_id = check_in_sessions.event_id
        and registration.user_id = public.current_user_info_id()
    )
  );

drop policy if exists "Authenticated users can view event_application_questions" on public.event_application_questions;
drop policy if exists "Admins can insert event_application_questions" on public.event_application_questions;
drop policy if exists "Admins can update event_application_questions" on public.event_application_questions;
drop policy if exists "Admins can delete event_application_questions" on public.event_application_questions;

create policy "application questions: applicants read"
  on public.event_application_questions
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.event_registrations registration
      where registration.event_id = event_application_questions.event_id
        and registration.user_id = public.current_user_info_id()
    )
    or exists (
      select 1
      from public.events event
      where event.id = event_application_questions.event_id
        and now() >= coalesce(event.registration_start_time, '-infinity'::timestamptz)
        and now() <= coalesce(event.registration_end_time, 'infinity'::timestamptz)
    )
  );

drop policy if exists "admin can select purchases" on public.purchases;
drop policy if exists "admin can delete failed event purchases" on public.purchases;

create policy "purchases: admins read all"
  on public.purchases
  for select
  to authenticated
  using (public.is_admin());

create policy "purchases: admins delete failed event purchases"
  on public.purchases
  for delete
  to authenticated
  using (
    public.is_admin()
    and kind = 'event_ticket'
    and status = 'failed'
    and event_id is not null
  );

revoke all on table public.purchases from anon;
