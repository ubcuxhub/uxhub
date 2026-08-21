-- Restores the 'draft' default. The backfill is not reversible: once drafts
-- have been flipped to active there is no record of which rows they were.

alter table public.events
  alter column status set default 'draft'::public.event_status;
