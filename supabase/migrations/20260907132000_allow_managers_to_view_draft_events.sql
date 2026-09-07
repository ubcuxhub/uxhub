drop policy if exists "admin_select_all_events" on public.events;

create policy "admin_select_all_events"
  on public.events
  for select
  to authenticated
  using (public.is_admin());

comment on policy "admin_select_all_events" on public.events is
  'Admins and managers may view draft and archived events; everyone else only sees active events through the public select policy.';
