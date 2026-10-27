-- Corrects event_tickets from 20270101000004.
--
-- Its backfill also issued tickets for registrations that only had a
-- purchase_id, which is a reservation still being paid for or abandoned, not
-- a ticket. Nothing has issued tickets since (no code calls
-- reserve_event_ticket yet), so every row is a backfilled copy: clear them,
-- and 20270101000010 copies attending registrations back in. check_ins.ticket_id
-- cascades, so unlink check-ins first or deleting a ticket deletes them.
--
-- It also left the default grants that give anon and authenticated full
-- access; RLS stopped them, but tickets are only issued on the server.

update public.check_ins set ticket_id = null where ticket_id is not null;
delete from public.event_tickets;

revoke all on table public.event_tickets from anon, authenticated;
grant select on table public.event_tickets to authenticated;
grant all on table public.event_tickets to service_role;
