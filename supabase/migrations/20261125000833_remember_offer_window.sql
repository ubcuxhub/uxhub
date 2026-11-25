-- The offer window an admin last gave on this event, so the next accept
-- starts from it (docs/event-states.md, "Decision release"): how many Pacific
-- calendar days after the earliest moment an offer can start (now, or the
-- decision release while that is ahead), and the wall-clock time of day.
-- Written by the decision action after each accept; the event builder's save
-- never touches these columns. Additive only, so the code in production keeps
-- working while it runs.
alter table public.event_application_settings
  add column offer_window_days integer,
  add column offer_deadline_time time,
  add constraint offer_window_complete check (
    (offer_window_days is null) = (offer_deadline_time is null)
  ),
  add constraint offer_window_days_range check (
    offer_window_days is null or offer_window_days between 0 and 366
  );
