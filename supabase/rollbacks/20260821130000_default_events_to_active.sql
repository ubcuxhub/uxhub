-- Restores the 'draft' default. Fully reversible: the forward migration only
-- changes the default and does not touch existing rows.

alter table public.events
  alter column status set default 'draft'::public.event_status;
