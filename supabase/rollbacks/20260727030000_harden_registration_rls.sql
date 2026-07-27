drop policy if exists "registrations: read own" on public.event_registrations;
drop policy if exists "registrations: admins read all" on public.event_registrations;
drop policy if exists "registrations: insert own pending" on public.event_registrations;
drop policy if exists "registrations: admins update" on public.event_registrations;

create policy "user can select event registrations"
  on public.event_registrations for select to authenticated using (true);
create policy "user can insert event registrations"
  on public.event_registrations for insert to authenticated with check (true);
create policy "user can update event registrations"
  on public.event_registrations for update to authenticated
  using (true) with check (true);
create policy "user can delete event registrations"
  on public.event_registrations for delete to authenticated using (true);

drop policy if exists "application responses: read own" on public.event_application_responses;
drop policy if exists "application responses: admins read all" on public.event_application_responses;
drop policy if exists "application responses: insert own" on public.event_application_responses;
drop policy if exists "application responses: update own" on public.event_application_responses;
drop policy if exists "application responses: delete own" on public.event_application_responses;

create policy "Enable insert for authenticated users only"
  on public.event_application_responses for insert to authenticated with check (true);
create policy "Enable read access for all users"
  on public.event_application_responses for select to authenticated using (true);
create policy "Users can delete their applications"
  on public.event_application_responses for delete to authenticated using (true);
create policy "Users can update their application"
  on public.event_application_responses for update to authenticated using (true);

drop policy if exists "check-in sessions: registered users read" on public.check_in_sessions;
create policy "Authenticated users can view check-in sessions"
  on public.check_in_sessions for select to authenticated using (true);
create policy "Admins can insert check-in sessions"
  on public.check_in_sessions for insert to authenticated with check (public.is_admin());
create policy "Admins can update check-in sessions"
  on public.check_in_sessions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete check-in sessions"
  on public.check_in_sessions for delete to authenticated using (public.is_admin());

drop policy if exists "application questions: applicants read" on public.event_application_questions;
create policy "Authenticated users can view event_application_questions"
  on public.event_application_questions for select to authenticated using (true);
create policy "Admins can insert event_application_questions"
  on public.event_application_questions for insert to authenticated with check (public.is_admin());
create policy "Admins can update event_application_questions"
  on public.event_application_questions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete event_application_questions"
  on public.event_application_questions for delete to authenticated using (public.is_admin());

drop policy if exists "purchases: admins read all" on public.purchases;
drop policy if exists "purchases: admins delete failed event purchases" on public.purchases;
create policy "admin can select purchases"
  on public.purchases for select to authenticated using (public.is_admin());
create policy "admin can delete failed event purchases"
  on public.purchases for delete to authenticated
  using (
    public.is_admin()
    and kind = 'event_ticket'
    and status = 'failed'
    and event_id is not null
  );

grant all on table public.purchases to anon;
