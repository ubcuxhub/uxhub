-- 20260702234500 added events.status defaulting to 'draft', and restricted the
-- public select policy to active events. Nothing in the app ever sets a status:
-- the admin event form has no status control and saveAdminEventAction does not
-- pass one, so every event created through the app has been landing as 'draft'
-- and has been invisible on /events and in the portal. Admin pages read through
-- the service-role client, which bypasses RLS, so the event looked published to
-- whoever created it.
--
-- Default to 'active' so creating an event does what the app implies. The
-- column and policy stay in place; if a draft/publish workflow is built later,
-- move the default back and add the UI in the same change.

alter table public.events
  alter column status set default 'active'::public.event_status;

-- Deliberately no backfill. 20260702234500 already flipped every row that
-- existed then to 'active', so any remaining draft was set by hand afterwards
-- and is intentional. Production currently has exactly one, drafted through the
-- dashboard a week after that migration ran. Flipping it here would publish
-- something a person chose to hide.
