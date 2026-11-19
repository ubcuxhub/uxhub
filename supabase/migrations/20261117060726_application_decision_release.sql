-- Application decisions: release, offer deadlines and capacity
-- (docs/event-states.md, "Admin: application" and "Decision release").
--
-- 1. `application_decisions_released(event)`: true once the event's
--    "Release decisions on" (event_application_settings.decisions_release_at)
--    has passed, or when none is set.
-- 2. Before release an applicant can't read a decided application. "Read own"
--    is narrowed to drafts, submitted applications and released decisions,
--    and `get_my_event_applications` reports a decided one as submitted,
--    without its deadline or update time. Reading their own answers moves to
--    a security-definer check, so a hidden decision doesn't hide the answers.
-- 3. Checkout and reservation refuse before release (APPLICATION_REQUIRED),
--    through `event_ticket_eligibility`, which both run.
-- 4. Before release, decisions can change freely among submitted, waitlisted,
--    accepted and rejected; after it, the moves stay as they were.
-- 5. `decide_event_application` records a decision under the event lock that
--    reservation takes: an accept that would take a seat checks capacity
--    (OVER_CAPACITY unless the admin overrides), and every offer deadline
--    must fall after now and after the release.
-- 6. Once applicants can see decisions, "Release decisions on" can't move into
--    the future (EVENT_SETTINGS_CONFLICT).
--
-- Backward compatible with the deployed code: admins keep reading through
-- "applications: admins read submitted", the deployed decision path (a direct
-- service-role update) keeps working, and members' direct reads only lose
-- decisions nobody has released. No function changes its signature.

-- 1. Release ------------------------------------------------------------------

create function public.application_decisions_released(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select settings.decisions_release_at <= now()
    from public.event_application_settings settings
    where settings.event_id = p_event_id
      and settings.decisions_release_at is not null
  ), true);
$$;

revoke all on function public.application_decisions_released(uuid) from public, anon;
grant execute on function public.application_decisions_released(uuid) to authenticated, service_role;

-- 2. What applicants read -----------------------------------------------------

-- From 20261015000003, narrowed: a decision stays hidden until release.
drop policy "applications: read own" on public.event_applications;
create policy "applications: read own"
on public.event_applications
for select
to authenticated
using (
  user_id = public.current_user_info_id()
  and (
    status in ('draft', 'submitted')
    or public.application_decisions_released(event_id)
  )
);

-- True when the caller owns the application, whatever its status. Security
-- definer, so the answers policy below doesn't depend on what the caller can
-- select from event_applications.
create function public.owns_event_application(p_application_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.event_applications application
    where application.id = p_application_id
      and application.user_id = public.current_user_info_id()
  );
$$;

revoke all on function public.owns_event_application(uuid) from public, anon;
grant execute on function public.owns_event_application(uuid) to authenticated;

-- From 20261015000008: an applicant still reads their own answers while the
-- decision on them is hidden.
drop policy "application responses: read own application" on public.event_application_responses;
create policy "application responses: read own application"
on public.event_application_responses
for select
to authenticated
using (public.owns_event_application(application_id));

-- The caller's applications to these events, as they may see them. Before
-- release a decided application reads as `submitted`, with no
-- `offer_expires_at` and no `updated_at` (which would show that something
-- changed). `decisions_release_at` is always the event's setting, null when
-- none is set.
create function public.get_my_event_applications(p_event_ids uuid[])
returns table (
  id                   uuid,
  event_id             uuid,
  user_id              uuid,
  status               public.event_application_status,
  offer_expires_at     timestamptz,
  submitted_at         timestamptz,
  created_at           timestamptz,
  updated_at           timestamptz,
  decisions_release_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    application.id,
    application.event_id,
    application.user_id,
    case
      when application.status = 'draft' or visible.released then application.status
      else 'submitted'::public.event_application_status
    end,
    case when visible.released then application.offer_expires_at end,
    application.submitted_at,
    application.created_at,
    case when application.status = 'draft' or visible.released then application.updated_at end,
    settings.decisions_release_at
  from public.event_applications application
  left join public.event_application_settings settings
    on settings.event_id = application.event_id
  cross join lateral (
    select settings.decisions_release_at is null
      or settings.decisions_release_at <= now() as released
  ) visible
  where application.user_id = public.current_user_info_id()
    and application.event_id = any(p_event_ids);
$$;

revoke all on function public.get_my_event_applications(uuid[]) from public, anon;
grant execute on function public.get_my_event_applications(uuid[]) to authenticated;

-- 3. Eligibility --------------------------------------------------------------

-- As in 20261117054623, with one more rule in step 4: an offer counts only
-- once decisions are released. reserve_event_ticket and
-- initialize_event_checkout both run this, so neither issues a ticket nor
-- starts a payment before release.
create or replace function public.event_ticket_eligibility(
  p_event_id uuid,
  p_user_id uuid,
  p_amount_cents bigint default 0
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_is_staff boolean;
  v_application public.event_applications%rowtype;
  v_seats_left integer;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then return 'EVENT_NOT_FOUND'; end if;

  select role_access in ('admin'::public.role_access_enum, 'manager'::public.role_access_enum)
  into v_is_staff
  from public.user_info where id = p_user_id and deleted_at is null;
  if not found then return 'USER_NOT_FOUND'; end if;

  if v_event.canceled_at is not null then return 'EVENT_CANCELED'; end if;

  if not public.event_is_public(v_event.status, v_event.publish_at) then
    if not coalesce(v_is_staff, false)
       or p_amount_cents is distinct from 0
       or v_event.regular_price is distinct from 0
       or coalesce(v_event.member_price, 0) <> 0 then
      return 'EVENT_NOT_ACTIVE';
    end if;
  end if;

  if v_event.requires_application then
    select * into v_application from public.event_applications
    where event_id = p_event_id and user_id = p_user_id;
    if not found or v_application.status <> 'accepted' then return 'APPLICATION_REQUIRED'; end if;
    -- An unreleased offer is one the applicant can't see yet.
    if not public.application_decisions_released(p_event_id) then return 'APPLICATION_REQUIRED'; end if;
    if v_application.offer_expires_at <= now() then return 'OFFER_EXPIRED'; end if;
    return null;
  end if;

  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    return 'REGISTRATION_NOT_OPEN';
  end if;
  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    return 'REGISTRATION_CLOSED';
  end if;

  select counts.seats_left into v_seats_left
  from public.event_seat_counts_unfiltered(array[p_event_id]) counts;
  if v_seats_left <= 0 then return 'SOLD_OUT'; end if;

  return null;
end;
$$;

-- 4. Allowed moves ------------------------------------------------------------

-- From 20261106193112. Before release nobody has seen a decision, so it may
-- change freely among submitted, waitlisted, accepted and rejected. An offer
-- someone has registered on can't be changed at all.
create or replace function public.check_event_application_transition()
returns trigger
language plpgsql set search_path = '' as $$
declare
  v_allowed boolean;
begin
  if new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'An application cannot move to another event or person.'
      using errcode = 'check_violation';
  end if;

  v_allowed := case old.status
    when 'draft' then
      new.status = 'draft'
      or (
        new.status = 'submitted'
        and current_setting('uxhub.submitting_application', true) = 'on'
      )
    when 'submitted' then new.status <> 'draft'
    when 'waitlisted' then new.status in ('waitlisted', 'accepted', 'rejected')
    when 'accepted' then new.status in ('accepted', 'rejected')
    when 'rejected' then new.status = 'rejected'
    else false
  end;

  if not v_allowed
     and old.status <> 'draft' and new.status <> 'draft'
     and not public.application_decisions_released(new.event_id) then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'An application cannot go from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if old.status = 'accepted' and new.status <> 'accepted' and exists (
    select 1
    from public.event_tickets ticket
    where ticket.event_id = new.event_id
      and ticket.user_id = new.user_id
  ) then
    raise exception 'This applicant already has a ticket, so the offer cannot be taken back.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- 5. Deciding -----------------------------------------------------------------

-- Records an admin's decision: 'accept' (with p_offer_expires_at), 'waitlist'
-- or 'reject'. Returns one row; `failure_reason` is null on success, else:
--   NOT_FOUND           no such application
--   NOT_SUBMITTED       a draft, which nobody decides
--   INVALID_DECISION    not one of the three
--   DEADLINE_REQUIRED   an accept without a deadline
--   DEADLINE_TOO_EARLY  the deadline is not after now and the release
--   HAS_TICKET          the applicant registered, so the offer stands
--   NOT_ALLOWED         a move the review flow doesn't allow after release
--   OVER_CAPACITY       accepting would take a seat the event doesn't have;
--                       pass p_allow_over_capacity to accept anyway
-- The seat counts (tickets, held offers, capacity) are as they stood before
-- the decision; `over_capacity` is true when an override took a seat past
-- capacity. Serializes with reservation on the event row, so two accepts for
-- the last seat can't both take it.
create function public.decide_event_application(
  p_application_id uuid,
  p_decision text,
  p_offer_expires_at timestamptz default null,
  p_allow_over_capacity boolean default false
)
returns table (
  failure_reason       text,
  application_id       uuid,
  event_id             uuid,
  user_id              uuid,
  previous_status      public.event_application_status,
  status               public.event_application_status,
  offer_expires_at     timestamptz,
  decisions_release_at timestamptz,
  tickets              integer,
  held_offers          integer,
  max_capacity         integer,
  over_capacity        boolean
)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_application public.event_applications%rowtype;
  v_release timestamptz;
  v_status public.event_application_status;
  v_deadline timestamptz;
  v_has_ticket boolean;
  v_holds_seat boolean;
  v_tickets integer;
  v_held integer;
  v_over boolean := false;
begin
  select a.event_id into v_event_id from public.event_applications a where a.id = p_application_id;
  if not found then
    return query select 'NOT_FOUND'::text, p_application_id, null::uuid, null::uuid,
      null::public.event_application_status, null::public.event_application_status,
      null::timestamptz, null::timestamptz, null::integer, null::integer, null::integer, false;
    return;
  end if;

  -- The lock reservation and checkout take.
  select * into v_event from public.events e where e.id = v_event_id for update;
  select * into v_application from public.event_applications a where a.id = p_application_id for update;
  select s.decisions_release_at into v_release
  from public.event_application_settings s where s.event_id = v_event_id;

  select c.tickets, c.held_offers into v_tickets, v_held
  from public.event_seat_counts_unfiltered(array[v_event_id]) c;

  v_status := case p_decision
    when 'accept' then 'accepted'::public.event_application_status
    when 'waitlist' then 'waitlisted'::public.event_application_status
    when 'reject' then 'rejected'::public.event_application_status
  end;
  v_deadline := case when v_status = 'accepted' then p_offer_expires_at end;
  v_has_ticket := exists (
    select 1 from public.event_tickets t
    where t.event_id = v_event_id and t.user_id = v_application.user_id
  );

  failure_reason := case
    when v_application.status = 'draft' then 'NOT_SUBMITTED'
    when v_status is null then 'INVALID_DECISION'
    when v_status = 'accepted' and v_deadline is null then 'DEADLINE_REQUIRED'
    when v_status = 'accepted' and v_deadline <= greatest(now(), coalesce(v_release, now())) then 'DEADLINE_TOO_EARLY'
    when v_application.status = 'accepted' and v_status <> 'accepted' and v_has_ticket then 'HAS_TICKET'
  end;

  if failure_reason is null and v_status = 'accepted' then
    -- A ticket or an unexpired offer already holds this applicant's seat.
    v_holds_seat := v_has_ticket
      or (v_application.status = 'accepted' and v_application.offer_expires_at > now());
    if not v_holds_seat and v_event.max_capacity is not null
       and v_tickets + v_held >= v_event.max_capacity then
      if p_allow_over_capacity then
        v_over := true;
      else
        failure_reason := 'OVER_CAPACITY';
      end if;
    end if;
  end if;

  if failure_reason is null then
    begin
      update public.event_applications a
      set status = v_status, offer_expires_at = v_deadline
      where a.id = p_application_id;
    exception when check_violation then
      failure_reason := 'NOT_ALLOWED';
    end;
  end if;

  return query select
    failure_reason,
    v_application.id,
    v_event_id,
    v_application.user_id,
    v_application.status,
    case when failure_reason is null then v_status else v_application.status end,
    case when failure_reason is null then v_deadline else v_application.offer_expires_at end,
    v_release,
    v_tickets,
    v_held,
    v_event.max_capacity,
    v_over;
end;
$$;

revoke all on function public.decide_event_application(uuid, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.decide_event_application(uuid, text, timestamptz, boolean) to service_role;

-- 6. Release time -------------------------------------------------------------

-- Once applicants can see decisions (the release has passed, or none was set
-- and some application is decided), the release can't move into the future:
-- that would hide decisions people have already seen.
create function public.guard_application_release_time()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old timestamptz := case when tg_op = 'UPDATE' then old.decisions_release_at end;
begin
  if new.decisions_release_at is not null
     and new.decisions_release_at > now()
     and new.decisions_release_at is distinct from v_old
     and (
       (v_old is not null and v_old <= now())
       or (v_old is null and exists (
         select 1 from public.event_applications a
         where a.event_id = new.event_id
           and a.status in ('accepted', 'waitlisted', 'rejected')
       ))
     ) then
    raise exception 'Applicants can already see decisions, so Release decisions on can’t move later than now.'
      using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_application_release_time() from public, anon, authenticated;

create trigger guard_application_release_time
before insert or update of decisions_release_at on public.event_application_settings
for each row execute function public.guard_application_release_time();
