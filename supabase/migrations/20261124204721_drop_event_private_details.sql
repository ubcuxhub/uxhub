-- Drop the retired `event_private_details` table.
--
-- 20261124153406 stopped the event save functions mirroring the online meeting
-- details into it, and no deployed code reads it (pages read meeting details
-- from `event_date_location_settings`). Its data is unused, so nothing is
-- migrated. Dropping the table also drops its updated_at and historical-guard
-- triggers, its RLS policies and its grants. No function, view or policy on
-- another table references it any more.

drop table if exists public.event_private_details;
