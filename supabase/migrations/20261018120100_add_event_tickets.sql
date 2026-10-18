-- event_tickets from docs/schema-proposed.sql, and check_ins.ticket_id.
--
-- Additive only. event_registrations stays the table the deployed code reads
-- and writes; 20261018120400 copies its attendees in here.

create table public.event_tickets (
  id          uuid        not null default gen_random_uuid(),
  event_id    uuid        not null,
  user_id     uuid        not null,
  purchase_id uuid,
  qr_token    text        not null default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint event_tickets_pkey primary key (id),
  constraint event_tickets_event_id_fkey
    foreign key (event_id) references public.events (id) on delete cascade,
  constraint event_tickets_user_id_fkey
    foreign key (user_id) references public.user_info (id),
  constraint event_tickets_purchase_id_fkey
    foreign key (purchase_id) references public.purchases (id) on delete set null,
  constraint event_tickets_event_id_user_id_key unique (event_id, user_id),
  constraint event_tickets_purchase_id_key unique (purchase_id),
  constraint event_tickets_qr_token_key unique (qr_token)
);

create index event_tickets_user_id_idx on public.event_tickets (user_id);

create trigger update_event_tickets_updated_at
before update on public.event_tickets
for each row execute function public.update_updated_at_column();

alter table public.event_tickets enable row level security;

create policy "tickets: read own"
on public.event_tickets
for select
to authenticated
using (user_id = public.current_user_info_id());

create policy "tickets: admins read all"
on public.event_tickets
for select
to authenticated
using (public.is_admin());

-- Tickets are only issued by reserve_event_ticket, as service_role.
revoke all on table public.event_tickets from anon, authenticated;
grant select on table public.event_tickets to authenticated;
grant all on table public.event_tickets to service_role;

-- Filled for check-ins of backfilled tickets. event_registration_id stays
-- required until the code checks people in by ticket.
alter table public.check_ins
  add column ticket_id uuid references public.event_tickets (id) on delete cascade,
  add constraint check_ins_ticket_id_check_in_session_id_key
    unique (ticket_id, check_in_session_id);
