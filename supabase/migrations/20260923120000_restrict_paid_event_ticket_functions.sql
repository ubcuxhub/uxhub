-- Callable only by the service role, from payment fulfillment. The earlier
-- migrations granted service_role without revoking the default grant, so anon
-- and authenticated could call both functions through PostgREST. Mirrors
-- delete_event_atomically.
revoke all on function public.reserve_paid_event_ticket(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_paid_event_ticket(uuid, uuid, uuid)
  to service_role;

revoke all on function public.release_paid_event_ticket_reservation(uuid)
  from public, anon, authenticated;

grant execute on function public.release_paid_event_ticket_reservation(uuid)
  to service_role;
