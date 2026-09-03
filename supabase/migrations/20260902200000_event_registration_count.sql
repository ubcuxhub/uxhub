-- Public pages need a seat count without reading registration rows.
create function public.event_registration_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.event_registrations
  where event_id = p_event_id;
$$;

revoke all on function public.event_registration_count(uuid)
  from public, anon, authenticated;
grant execute on function public.event_registration_count(uuid)
  to anon, authenticated;
