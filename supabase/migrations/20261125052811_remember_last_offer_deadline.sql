-- The exact deadline of the last offer an admin made on this event, so the
-- next accept starts from the same moment while it is still ahead
-- (docs/event-states.md, "Decision release"). Once it has passed, the review
-- page falls back to the remembered window (offer_window_days,
-- offer_deadline_time). Written by the decision action after each accept; the
-- event builder's save never touches it. Additive only, so the code in
-- production keeps working while it runs.
alter table public.event_application_settings
  add column last_offer_expires_at timestamptz;
