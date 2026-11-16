-- is_admin intentionally has no anonymous EXECUTE grant. Keep that boundary
-- rather than granting visitors a staff helper just to evaluate display state.
drop policy "participant agenda display enabled" on public.event_agenda_days;
create policy "anonymous agenda display enabled" on public.event_agenda_days
  as restrictive for select to anon
  using (exists(select 1 from public.events e where e.id=event_id and e.agenda_enabled));
create policy "member agenda display enabled" on public.event_agenda_days
  as restrictive for select to authenticated
  using (public.is_admin() or exists(select 1 from public.events e where e.id=event_id and e.agenda_enabled));

drop policy "participant agenda items display enabled" on public.event_agenda_items;
create policy "participant agenda items display enabled" on public.event_agenda_items
  as restrictive for select to anon,authenticated
  using (exists(select 1 from public.event_agenda_days d where d.id=event_agenda_day_id));
