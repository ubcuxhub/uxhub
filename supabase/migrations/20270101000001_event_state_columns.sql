-- Migration: event timing columns, publish_at, requires_application, CHECKs
--
-- Adds the new timestamptz columns to `events`, backfills them from the old
-- date/time columns (interpreted in America/Vancouver), renames
-- applications_enabled → requires_application, and adds CHECK constraints.
--
-- Old columns (start_date, start_time, end_date, end_time,
-- registration_start_time, registration_end_time) are NOT dropped here —
-- they are removed in a later migration once application code stops reading
-- them. This migration is safe to run on a live database.
--
-- Also rewrites save_admin_event_atomically and reserve_paid_event_ticket to
-- use the new column names so the stored procedures stay in sync.


-- ── 1. Add new columns ────────────────────────────────────────────────────

alter table public.events
  add column if not exists publish_at              timestamptz,
  add column if not exists starts_at               timestamptz,
  add column if not exists ends_at                 timestamptz,
  add column if not exists registration_opens_at   timestamptz,
  add column if not exists registration_closes_at  timestamptz;


-- ── 2. Backfill ───────────────────────────────────────────────────────────
--
-- starts_at: date + time (default '00:00:00' when time is null) → timestamptz
-- ends_at:   only set when both end_date and end_time exist
-- registration_*_at: already timestamptz in the old schema, copied directly.

update public.events
set
  starts_at = (
    start_date + coalesce(start_time, '00:00:00'::time)
  ) at time zone 'America/Vancouver',

  ends_at = case
    when end_date is not null and end_time is not null then
      (end_date + end_time) at time zone 'America/Vancouver'
    else null
  end,

  registration_opens_at  = registration_start_time,

  registration_closes_at = registration_end_time

where start_date is not null;

-- rows that have no start_date at all: leave all new columns null (already
-- null from the ADD COLUMN above).


-- ── 3. Rename applications_enabled → requires_application ─────────────────

alter table public.events
  rename column applications_enabled to requires_application;


-- ── 4. CHECK constraints ──────────────────────────────────────────────────

alter table public.events
  add constraint events_ends_at_gte_starts_at
    check (ends_at is null or starts_at is null or ends_at >= starts_at),

  add constraint events_registration_closes_at_gte_opens_at
    check (
      registration_closes_at is null
      or registration_opens_at is null
      or registration_closes_at >= registration_opens_at
    );


-- ── 5. Update save_admin_event_atomically ─────────────────────────────────
--
-- The current live version (from 20260828120000_guard_event_cover_image_on_save.sql)
-- accepts 8 parameters.  We replace it in-place with the same signature but
-- write requires_application and the new timestamptz columns instead of the
-- old ones.  Old columns are still written so the current app code keeps
-- working until it is updated (task 7).

drop function if exists public.save_admin_event_atomically(
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
);

create or replace function public.save_admin_event_atomically(
  p_event_id          uuid,
  p_event             jsonb,
  p_slug              text,
  p_expected_image_url text,
  p_check_in_sessions  jsonb,
  p_application_questions jsonb,
  p_mentors           jsonb,
  p_sponsors          jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id         uuid;
  v_next_image_url   text;
  v_image_changed    boolean;
begin
  if p_event_id is null then
    insert into public.events (
      name,
      short_description,
      description,
      status,
      event_type,
      mentors_enabled,
      sponsors_enabled,
      requires_application,
      regular_price,
      member_price,
      max_capacity,
      created_at,
      location_building,
      location_room,
      location_address_url,
      -- legacy date/time columns kept for backward compat until task-7 update
      start_date,
      start_time,
      end_date,
      end_time,
      -- new timestamptz columns
      starts_at,
      ends_at,
      image_url,
      registration_start_time,
      registration_end_time,
      registration_opens_at,
      registration_closes_at,
      slug
    )
    values (
      p_event ->> 'name',
      p_event ->> 'short_description',
      p_event ->> 'description',
      (p_event ->> 'status')::public.event_status,
      (p_event ->> 'event_type')::public.event_type,
      (p_event ->> 'mentors_enabled')::boolean,
      (p_event ->> 'sponsors_enabled')::boolean,
      (p_event ->> 'requires_application')::boolean,
      (p_event ->> 'regular_price')::numeric,
      (p_event ->> 'member_price')::numeric,
      (p_event ->> 'max_capacity')::integer,
      (p_event ->> 'created_at')::timestamptz,
      p_event ->> 'location_building',
      p_event ->> 'location_room',
      p_event ->> 'location_address_url',
      -- legacy
      (p_event ->> 'start_date')::date,
      (p_event ->> 'start_time')::time,
      (p_event ->> 'end_date')::date,
      (p_event ->> 'end_time')::time,
      -- new
      (p_event ->> 'starts_at')::timestamptz,
      (p_event ->> 'ends_at')::timestamptz,
      p_event ->> 'image_url',
      (p_event ->> 'registration_start_time')::timestamptz,
      (p_event ->> 'registration_end_time')::timestamptz,
      (p_event ->> 'registration_opens_at')::timestamptz,
      (p_event ->> 'registration_closes_at')::timestamptz,
      p_slug
    )
    returning id into v_event_id;
  else
    v_next_image_url := p_event ->> 'image_url';
    v_image_changed := v_next_image_url is distinct from p_expected_image_url;

    update public.events
    set
      name                  = p_event ->> 'name',
      short_description     = p_event ->> 'short_description',
      description           = p_event ->> 'description',
      status                = (p_event ->> 'status')::public.event_status,
      event_type            = (p_event ->> 'event_type')::public.event_type,
      mentors_enabled       = (p_event ->> 'mentors_enabled')::boolean,
      sponsors_enabled      = (p_event ->> 'sponsors_enabled')::boolean,
      requires_application  = (p_event ->> 'requires_application')::boolean,
      regular_price         = (p_event ->> 'regular_price')::numeric,
      member_price          = (p_event ->> 'member_price')::numeric,
      max_capacity          = (p_event ->> 'max_capacity')::integer,
      created_at            = (p_event ->> 'created_at')::timestamptz,
      location_building     = p_event ->> 'location_building',
      location_room         = p_event ->> 'location_room',
      location_address_url  = p_event ->> 'location_address_url',
      -- legacy date/time columns kept for backward compat until task-7 update
      start_date            = (p_event ->> 'start_date')::date,
      start_time            = (p_event ->> 'start_time')::time,
      end_date              = (p_event ->> 'end_date')::date,
      end_time              = (p_event ->> 'end_time')::time,
      -- new timestamptz columns
      starts_at             = (p_event ->> 'starts_at')::timestamptz,
      ends_at               = (p_event ->> 'ends_at')::timestamptz,
      image_url = case
        when v_image_changed then v_next_image_url
        else image_url
      end,
      registration_start_time =
        (p_event ->> 'registration_start_time')::timestamptz,
      registration_end_time =
        (p_event ->> 'registration_end_time')::timestamptz,
      registration_opens_at =
        (p_event ->> 'registration_opens_at')::timestamptz,
      registration_closes_at =
        (p_event ->> 'registration_closes_at')::timestamptz
    where id = p_event_id
      and (
        not v_image_changed
        or image_url is not distinct from p_expected_image_url
      )
    returning id into v_event_id;

    if v_event_id is null then
      if exists (select 1 from public.events where id = p_event_id) then
        raise exception 'EVENT_IMAGE_CONFLICT';
      end if;

      raise exception 'Event not found.';
    end if;

    delete from public.check_in_sessions where event_id = v_event_id;
    delete from public.event_application_questions where event_id = v_event_id;
  end if;

  insert into public.check_in_sessions (event_id, name, start_time, end_time)
  select
    v_event_id,
    item.name,
    item.start_time,
    item.end_time
  from jsonb_to_recordset(coalesce(p_check_in_sessions, '[]'::jsonb))
    as item(name text, start_time timestamptz, end_time timestamptz);

  insert into public.event_application_questions (
    event_id,
    question,
    description,
    response_type,
    is_required,
    sort_order,
    max_char_limit,
    response_options,
    restrict_file_types,
    allowed_file_types,
    max_file_size_bytes
  )
  select
    v_event_id,
    item.question,
    item.description,
    item.response_type::public.response_type,
    coalesce(item.is_required, false),
    coalesce(item.sort_order, 0),
    item.max_char_limit,
    item.response_options,
    coalesce(item.restrict_file_types, false),
    item.allowed_file_types,
    item.max_file_size_bytes
  from jsonb_to_recordset(coalesce(p_application_questions, '[]'::jsonb))
    as item(
      question            text,
      description         text,
      response_type       text,
      is_required         boolean,
      sort_order          integer,
      max_char_limit      integer,
      response_options    text[],
      restrict_file_types boolean,
      allowed_file_types  text[],
      max_file_size_bytes bigint
    );

  if jsonb_array_length(coalesce(p_mentors, '[]'::jsonb)) <> (
    select count(distinct mentor_id)
    from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb))
      as mentor(mentor_id)
  ) then
    raise exception 'The same mentor cannot be selected more than once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb))
      as selected(mentor_id)
    left join public.mentors mentor on mentor.id = selected.mentor_id::uuid
    where mentor.id is null
  ) then
    raise exception 'A selected mentor was not found.';
  end if;

  insert into public.event_mentors (event_id, mentor_id, sort_order)
  select
    v_event_id,
    selected.mentor_id::uuid,
    selected.ordinality - 1
  from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb))
    with ordinality as selected(mentor_id, ordinality)
  on conflict (event_id, mentor_id)
  do update set sort_order = excluded.sort_order;

  delete from public.event_mentors event_mentor
  where event_mentor.event_id = v_event_id
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb))
        as selected(mentor_id)
      where selected.mentor_id::uuid = event_mentor.mentor_id
    );

  if jsonb_array_length(coalesce(p_sponsors, '[]'::jsonb)) <> (
    select count(distinct sponsor_id)
    from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb))
      as sponsor(sponsor_id)
  ) then
    raise exception 'The same sponsor cannot be selected more than once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb))
      as selected(sponsor_id)
    left join public.sponsors sponsor on sponsor.id = selected.sponsor_id::uuid
    where sponsor.id is null
  ) then
    raise exception 'A selected sponsor was not found.';
  end if;

  insert into public.event_sponsors (event_id, sponsor_id, sort_order)
  select
    v_event_id,
    selected.sponsor_id::uuid,
    selected.ordinality - 1
  from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb))
    with ordinality as selected(sponsor_id, ordinality)
  on conflict (event_id, sponsor_id)
  do update set sort_order = excluded.sort_order;

  delete from public.event_sponsors event_sponsor
  where event_sponsor.event_id = v_event_id
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb))
        as selected(sponsor_id)
      where selected.sponsor_id::uuid = event_sponsor.sponsor_id
    );

  return jsonb_build_object('id', v_event_id);
end;
$$;

revoke all on function public.save_admin_event_atomically(
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.save_admin_event_atomically(
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;


-- ── 6. Update reserve_paid_event_ticket ───────────────────────────────────
--
-- Replaces the version from 20260828130000_reserve_only_active_events.sql.
-- Uses registration_opens_at / registration_closes_at and requires_application
-- instead of the old column names. The function signature, return type and
-- grant restrictions are identical to the current live version.

create or replace function public.reserve_paid_event_ticket(
  p_event_id   uuid,
  p_user_id    uuid,
  p_purchase_id uuid
)
returns table (
  registration_id uuid,
  failure_reason  text
)
language plpgsql
as $$
declare
  v_event                   public.events%rowtype;
  v_existing_registration   public.event_registrations%rowtype;
  v_registration_id         uuid;
  v_occupied_count          integer;
begin
  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    return query select null::uuid, 'EVENT_NOT_FOUND'::text;
    return;
  end if;

  select *
  into v_existing_registration
  from public.event_registrations
  where purchase_id = p_purchase_id;

  if found then
    return query select v_existing_registration.id, null::text;
    return;
  end if;

  -- Checked after the purchase-id idempotency lookup so that a retry on an
  -- already-reserved purchase succeeds even if the event is no longer active.
  if v_event.status <> 'active' then
    return query select null::uuid, 'EVENT_NOT_ACTIVE'::text;
    return;
  end if;

  if v_event.requires_application and exists (
    select 1
    from public.event_application_questions
    where event_id = p_event_id
  ) then
    return query select null::uuid, 'APPLICATION_REQUIRED'::text;
    return;
  end if;

  if v_event.registration_opens_at is not null
    and now() < v_event.registration_opens_at then
    return query select null::uuid, 'REGISTRATION_NOT_OPEN'::text;
    return;
  end if;

  if v_event.registration_closes_at is not null
    and now() > v_event.registration_closes_at then
    return query select null::uuid, 'REGISTRATION_CLOSED'::text;
    return;
  end if;

  select *
  into v_existing_registration
  from public.event_registrations
  where event_id = p_event_id
    and user_id = p_user_id;

  if found then
    return query select v_existing_registration.id, 'ALREADY_REGISTERED'::text;
    return;
  end if;

  select count(*)
  into v_occupied_count
  from public.event_registrations
  where event_id = p_event_id
    and (
        purchase_id is not null
        or status = 'accepted'
        or coalesce(attending, false) = true
    );

  if v_occupied_count >= v_event.max_capacity then
    return query select null::uuid, 'SOLD_OUT'::text;
    return;
  end if;

  insert into public.event_registrations (
    event_id,
    user_id,
    status,
    attending,
    purchase_id
  )
  values (
    p_event_id,
    p_user_id,
    'pending',
    false,
    p_purchase_id
  )
  returning id into v_registration_id;

  return query select v_registration_id, null::text;
end;
$$;

-- Re-apply privilege restrictions from 20260923120000 (create or replace
-- resets grants to default, so we must revoke/grant again).
revoke all on function public.reserve_paid_event_ticket(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_paid_event_ticket(uuid, uuid, uuid)
  to service_role;
