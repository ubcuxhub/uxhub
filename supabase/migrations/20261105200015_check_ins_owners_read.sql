-- Students may read the check-ins on their own tickets, so the portal can show
-- an event's "Checked in" badge (docs/event-states.md). Writes stay admin-only.
create policy "check-ins: owners read"
  on public.check_ins
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_tickets ticket
      where ticket.id = check_ins.ticket_id
        and ticket.user_id = public.current_user_info_id()
    )
  );
