-- The admin events dashboard asked PostgREST for one head-count per event, so a
-- thirty-event list cost thirty requests fighting for pooler connections. This
-- aggregates in Postgres so the page needs one call returning one row per event.
--
-- Aggregating server-side rather than tallying in the app is deliberate:
-- PostgREST caps a response at max_rows (1000 here and by default on hosted
-- projects), so fetching every registration id and counting in JavaScript would
-- start returning silently wrong totals once the club passes a thousand
-- registrations. One row per event never approaches that ceiling.
--
-- Security invoker on purpose: row-level security on event_registrations still
-- decides what is countable, so an admin gets every row via
-- "registrations: admins read all" and a member counts only their own. That is
-- exactly what the per-event head query already did, so no caller gains
-- visibility from this function.

create or replace function public.event_registration_counts(p_event_ids uuid[])
returns table (event_id uuid, registration_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select registration.event_id, count(*)::bigint
  from public.event_registrations as registration
  where registration.event_id = any(p_event_ids)
  group by registration.event_id;
$$;

comment on function public.event_registration_counts(uuid[]) is
  'Registration totals for many events in one call, replacing the per-event count query on the admin events dashboard. Security invoker so RLS decides which registrations are countable.';

revoke all on function public.event_registration_counts(uuid[]) from public, anon;
grant execute on function public.event_registration_counts(uuid[]) to authenticated, service_role;
