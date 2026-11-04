-- Stops a new event inheriting a registration window nobody chose.
--
-- registration_start_time and registration_end_time default to now() and
-- now() + 7 days, and on insert sync_legacy_event_columns (20261015000006)
-- copies them into registration_opens_at and registration_closes_at when
-- those are null. The deployed admin form always sends both legacy keys, so
-- the defaults never applied. The next form sends only the new columns (see
-- docs/registration-rollout.md, step 2), so an event created with no
-- registration window, meaning always open, would close after a week.
--
-- Without the defaults the legacy columns stay null on such an insert, and
-- the trigger leaves the new ones as written. Step 3 drops the columns.

alter table public.events
  alter column registration_start_time drop default,
  alter column registration_end_time drop default;
