-- Separate applications, payment holds, and confirmed seats.

-- Retire routines and policies that depend on the legacy registration shape.
drop function if exists public.reserve_paid_event_ticket(uuid, uuid, uuid);
drop function if exists public.release_paid_event_ticket_reservation(uuid);
drop function if exists public.finalize_paid_event_ticket(uuid);
drop function if exists public.submit_event_application(uuid, jsonb);
drop function if exists public.review_event_application(uuid, public.application_status);
drop function if exists public.confirm_free_event_attendance(uuid);
drop function if exists public.mark_event_application_not_attending(uuid);

drop function if exists public.promote_from_waitlist();

drop policy if exists "registrations: read own" on public.event_registrations;
drop policy if exists "registrations: admins read all" on public.event_registrations;
drop policy if exists "registrations: insert own pending" on public.event_registrations;
drop policy if exists "registrations: admins update" on public.event_registrations;
drop policy if exists "user can select event registrations" on public.event_registrations;
drop policy if exists "user can insert event registrations" on public.event_registrations;
drop policy if exists "user can update event registrations" on public.event_registrations;
drop policy if exists "user can delete event registrations" on public.event_registrations;

drop policy if exists "application responses: read own" on public.event_application_responses;
drop policy if exists "application responses: admins read all" on public.event_application_responses;
drop policy if exists "application responses: insert own" on public.event_application_responses;
drop policy if exists "application responses: update own" on public.event_application_responses;
drop policy if exists "application responses: delete own" on public.event_application_responses;
drop policy if exists "Enable insert for authenticated users only" on public.event_application_responses;
drop policy if exists "Enable read access for all users" on public.event_application_responses;
drop policy if exists "Users can delete their applications" on public.event_application_responses;
drop policy if exists "Users can update their application" on public.event_application_responses;

drop policy if exists "application questions: applicants read" on public.event_application_questions;
drop policy if exists "Authenticated users can view event_application_questions" on public.event_application_questions;
drop policy if exists "Admins can insert event_application_questions" on public.event_application_questions;
drop policy if exists "Admins can update event_application_questions" on public.event_application_questions;
drop policy if exists "Admins can delete event_application_questions" on public.event_application_questions;

alter type public.application_status rename value 'declined' to 'rejected';

create type public.attendance_status as enum (
  'awaiting_confirmation',
  'confirmed',
  'not_attending'
);

-- Application fixture rows are intentionally discarded. Preserve only legacy
-- rows that already represent a real direct seat or a successful paid seat.
delete from public.event_registrations registration
where not (
  (
    registration.purchase_id is null
    and registration.status = 'accepted'::public.application_status
    and registration.attending is true
    and not exists (
      select 1
      from public.event_application_responses response
      where response.event_registration_id = registration.id
    )
  )
  or exists (
    select 1
    from public.purchases purchase
    where purchase.id = registration.purchase_id
      and purchase.kind = 'event_ticket'
      and purchase.status = 'completed'
      and purchase.event_id = registration.event_id
      and purchase.user_id = registration.user_id
  )
);

delete from public.event_application_responses;

create table public.event_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.user_info(id) on delete cascade,
  status public.application_status not null default 'pending',
  attendance_status public.attendance_status,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references public.user_info(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_applications_event_user_key unique (event_id, user_id),
  constraint event_applications_identity_key unique (id, event_id, user_id),
  constraint event_applications_review_state_check check (
    (
      status = 'pending'
      and reviewed_at is null
      and reviewer_id is null
      and attendance_status is null
    )
    or (
      status = 'rejected'
      and reviewed_at is not null
      and reviewer_id is not null
      and attendance_status is null
    )
    or (
      status = 'accepted'
      and reviewed_at is not null
      and reviewer_id is not null
      and attendance_status is not null
    )
  ),
  constraint event_applications_reviewed_after_submission_check check (
    reviewed_at is null or reviewed_at >= submitted_at
  )
);

create index idx_event_applications_event_status
  on public.event_applications(event_id, status, attendance_status);
create index idx_event_applications_user_id
  on public.event_applications(user_id);
create index idx_event_applications_reviewer_id
  on public.event_applications(reviewer_id);

create trigger update_event_applications_updated_at
before update on public.event_applications
for each row execute function public.update_updated_at_column();

alter table public.event_application_responses
  drop constraint if exists event_application_responses_event_application_question_id_e_key,
  drop constraint if exists event_application_responses_event_registration_id_fkey,
  drop column event_registration_id,
  add column event_application_id uuid not null
    references public.event_applications(id) on delete cascade,
  add constraint event_application_responses_question_application_key
    unique (event_application_question_id, event_application_id);

drop index if exists public.idx_event_application_responses_registration_id;
create index idx_event_application_responses_application_id
  on public.event_application_responses(event_application_id);

alter table public.event_registrations
  add column application_id uuid,
  drop column status,
  drop column reviewer_id,
  drop column attending;

alter table public.event_registrations
  add constraint event_registrations_application_identity_fkey
  foreign key (application_id, event_id, user_id)
  references public.event_applications(id, event_id, user_id)
  on delete restrict;

alter table public.purchases
  add constraint purchases_identity_key unique (id, event_id, user_id);

create unique index idx_event_registrations_application_id
  on public.event_registrations(application_id)
  where application_id is not null;

alter table public.purchases
  add column seat_hold_expires_at timestamptz,
  add column application_id uuid
    references public.event_applications(id) on delete restrict;

alter table public.purchases
  add constraint purchases_application_kind_check check (
    application_id is null or (
      kind = 'event_ticket'
      and event_id is not null
      and membership_type_id is null
    )
  ),
  add constraint purchases_application_identity_fkey
  foreign key (application_id, event_id, user_id)
  references public.event_applications(id, event_id, user_id)
  on delete restrict;

create index idx_purchases_active_seat_holds
  on public.purchases(event_id, seat_hold_expires_at)
  where seat_hold_expires_at is not null;

create unique index idx_purchases_live_application_checkout
  on public.purchases(application_id)
  where application_id is not null
    and status in ('pending', 'authorized', 'completed');

-- Normalize legacy question configuration before strengthening constraints.
update public.event_application_questions
set
  question = coalesce(nullif(btrim(question), ''), 'Question'),
  max_char_limit = case
    when response_type in ('short_text', 'long_text') then max_char_limit
    else null
  end,
  response_options = case
    when response_type in ('checkbox', 'multiple_choice', 'dropdown') then
      coalesce(
        (
          select array_agg(option_value order by first_ordinality)
          from (
            select btrim(option_value) as option_value, min(ordinality) as first_ordinality
            from unnest(response_options) with ordinality as option(option_value, ordinality)
            where nullif(btrim(option_value), '') is not null
            group by btrim(option_value)
          ) normalized_options
        ),
        array['Option 1', 'Option 2']::text[]
      )
    else null
  end,
  restrict_file_types = case
    when response_type = 'file_upload'
      and coalesce(cardinality(allowed_file_types), 0) > 0
      then restrict_file_types
    else false
  end,
  allowed_file_types = case
    when response_type = 'file_upload'
      and restrict_file_types
      and coalesce(cardinality(allowed_file_types), 0) > 0
      then allowed_file_types
    else null
  end,
  max_file_size_bytes = case
    when response_type = 'file_upload' then max_file_size_bytes
    else null
  end;

update public.event_application_questions question
set allowed_file_types = (
  select array_agg(file_type order by first_ordinality)
  from (
    select lower(btrim(file_type)) as file_type, min(ordinality) as first_ordinality
    from unnest(question.allowed_file_types)
      with ordinality as entry(file_type, ordinality)
    where nullif(btrim(file_type), '') is not null
    group by lower(btrim(file_type))
  ) cleaned_file_types
)
where question.response_type = 'file_upload'
  and question.restrict_file_types;

update public.event_application_questions
set
  restrict_file_types = false,
  allowed_file_types = null
where response_type = 'file_upload'
  and restrict_file_types
  and coalesce(cardinality(allowed_file_types), 0) = 0;

update public.event_application_questions
set response_options =
  response_options || array[response_options[1] || ' (alternative)']
where response_type in ('checkbox', 'multiple_choice', 'dropdown')
  and cardinality(response_options) = 1;

with ordered_questions as (
  select
    id,
    row_number() over (
      partition by event_id
      order by sort_order, created_at, id
    ) - 1 as next_sort_order
  from public.event_application_questions
)
update public.event_application_questions question
set sort_order = ordered.next_sort_order
from ordered_questions ordered
where ordered.id = question.id;

alter table public.event_application_questions
  drop constraint if exists event_application_questions_configuration_check,
  add constraint event_application_questions_question_check
    check (btrim(question) <> ''),
  add constraint event_application_questions_configuration_check check (
    (
      response_type in ('short_text', 'long_text')
      and response_options is null
      and restrict_file_types is false
      and allowed_file_types is null
      and max_file_size_bytes is null
    )
    or (
      response_type in ('checkbox', 'multiple_choice', 'dropdown')
      and max_char_limit is null
      and response_options is not null
      and cardinality(response_options) >= 2
      and array_position(response_options, null) is null
      and restrict_file_types is false
      and allowed_file_types is null
      and max_file_size_bytes is null
    )
    or (
      response_type = 'file_upload'
      and max_char_limit is null
      and response_options is null
      and (
        (
          restrict_file_types is false
          and allowed_file_types is null
        )
        or (
          restrict_file_types is true
          and allowed_file_types is not null
          and cardinality(allowed_file_types) > 0
          and array_position(allowed_file_types, null) is null
        )
      )
    )
  );

create unique index idx_event_application_questions_event_sort_unique
  on public.event_application_questions(event_id, sort_order);

-- Holds capacity without creating a registration. The legacy return column is
-- retained for a controlled application deployment; it is null until finalize.
create function public.reserve_paid_event_ticket(
  p_event_id uuid,
  p_user_id uuid,
  p_purchase_id uuid
)
returns table (
  registration_id uuid,
  failure_reason text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_purchase public.purchases%rowtype;
  v_application public.event_applications%rowtype;
  v_occupied_count integer;
  v_registration_id uuid;
begin
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    return query select null::uuid, 'EVENT_NOT_FOUND'::text;
    return;
  end if;

  select * into v_purchase
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found
    or v_purchase.kind <> 'event_ticket'
    or v_purchase.event_id is distinct from p_event_id
    or v_purchase.user_id is distinct from p_user_id
  then
    return query select null::uuid, 'INVALID_PURCHASE'::text;
    return;
  end if;

  select id into v_registration_id
  from public.event_registrations
  where purchase_id = p_purchase_id;

  if found then
    return query select v_registration_id, null::text;
    return;
  end if;

  if v_event.status <> 'active' then
    return query select null::uuid, 'EVENT_NOT_ACTIVE'::text;
    return;
  end if;

  if v_event.registration_start_time is not null
    and now() < v_event.registration_start_time
  then
    return query select null::uuid, 'REGISTRATION_NOT_OPEN'::text;
    return;
  end if;

  if v_event.registration_end_time is not null
    and now() > v_event.registration_end_time
  then
    return query select null::uuid, 'REGISTRATION_CLOSED'::text;
    return;
  end if;

  if exists (
    select 1
    from public.event_registrations
    where event_id = p_event_id
      and user_id = p_user_id
  ) then
    return query select null::uuid, 'ALREADY_REGISTERED'::text;
    return;
  end if;

  if v_event.applications_enabled then
    if v_purchase.application_id is null then
      return query select null::uuid, 'APPLICATION_REQUIRED'::text;
      return;
    end if;

    select * into v_application
    from public.event_applications
    where id = v_purchase.application_id
      and event_id = p_event_id
      and user_id = p_user_id
    for update;

    if not found
      or v_application.status <> 'accepted'
      or v_application.attendance_status <> 'awaiting_confirmation'
    then
      return query select null::uuid, 'APPLICATION_NOT_ACCEPTED'::text;
      return;
    end if;
  elsif v_purchase.application_id is not null then
    return query select null::uuid, 'APPLICATION_NOT_ALLOWED'::text;
    return;
  end if;

  select
    (select count(*) from public.event_registrations where event_id = p_event_id)
    + (
      select count(*)
      from public.purchases purchase
      where purchase.event_id = p_event_id
        and purchase.kind = 'event_ticket'
        and purchase.seat_hold_expires_at > now()
        and purchase.id <> p_purchase_id
    )
  into v_occupied_count;

  if v_occupied_count >= v_event.max_capacity then
    return query select null::uuid, 'SOLD_OUT'::text;
    return;
  end if;

  update public.purchases
  set seat_hold_expires_at = now() + interval '10 minutes'
  where id = p_purchase_id;

  return query select null::uuid, null::text;
end;
$$;

create function public.release_paid_event_ticket_reservation(p_purchase_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.purchases
  set seat_hold_expires_at = null
  where id = p_purchase_id
    and fulfilled_at is null
    and status <> 'completed';
$$;

create function public.finalize_paid_event_ticket(p_purchase_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
  v_event public.events%rowtype;
  v_application public.event_applications%rowtype;
  v_registration_id uuid;
  v_occupied_count integer;
begin
  select * into v_purchase
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found
    or v_purchase.kind <> 'event_ticket'
    or v_purchase.status <> 'completed'
    or v_purchase.event_id is null
  then
    raise exception 'PURCHASE_NOT_COMPLETED';
  end if;

  select id into v_registration_id
  from public.event_registrations
  where purchase_id = p_purchase_id;

  if found then
    return v_registration_id;
  end if;

  select * into v_event
  from public.events
  where id = v_purchase.event_id
  for update;

  if v_purchase.application_id is not null then
    select * into v_application
    from public.event_applications
    where id = v_purchase.application_id
      and event_id = v_purchase.event_id
      and user_id = v_purchase.user_id
    for update;

    if not found
      or v_application.status <> 'accepted'
      or v_application.attendance_status <> 'awaiting_confirmation'
    then
      raise exception 'APPLICATION_NOT_ACCEPTED';
    end if;
  end if;

  select
    (select count(*)
     from public.event_registrations
     where event_id = v_purchase.event_id)
    + (
      select count(*)
      from public.purchases purchase
      where purchase.event_id = v_purchase.event_id
        and purchase.kind = 'event_ticket'
        and purchase.seat_hold_expires_at > now()
        and purchase.id <> p_purchase_id
    )
  into v_occupied_count;

  if v_occupied_count >= v_event.max_capacity then
    raise exception 'SOLD_OUT';
  end if;

  insert into public.event_registrations (
    event_id,
    user_id,
    purchase_id,
    application_id
  )
  values (
    v_purchase.event_id,
    v_purchase.user_id,
    v_purchase.id,
    v_purchase.application_id
  )
  returning id into v_registration_id;

  if v_purchase.application_id is not null then
    update public.event_applications
    set attendance_status = 'confirmed'
    where id = v_purchase.application_id;
  end if;

  update public.purchases
  set
    seat_hold_expires_at = null,
    fulfilled_at = coalesce(fulfilled_at, now())
  where id = p_purchase_id;

  return v_registration_id;
end;
$$;

create function public.submit_event_application(
  p_event_id uuid,
  p_responses jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_application_id uuid;
  v_event public.events%rowtype;
begin
  select id into v_user_id
  from public.user_info
  where auth_user_id = auth.uid();

  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status <> 'active' or not v_event.applications_enabled then
    raise exception 'APPLICATIONS_NOT_AVAILABLE';
  end if;

  if now() < coalesce(v_event.registration_start_time, '-infinity'::timestamptz)
    or now() > coalesce(v_event.registration_end_time, 'infinity'::timestamptz)
  then
    raise exception 'APPLICATIONS_NOT_OPEN';
  end if;

  if jsonb_typeof(coalesce(p_responses, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_RESPONSES';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_responses, '[]'::jsonb))
      as response(question_id uuid, response text)
    left join public.event_application_questions question
      on question.id = response.question_id
      and question.event_id = p_event_id
    where question.id is null
      or (
        question.max_char_limit is not null
        and char_length(coalesce(response.response, '')) > question.max_char_limit
      )
      or (
        question.response_type in ('multiple_choice', 'dropdown')
        and not (response.response = any(question.response_options))
      )
  ) then
    raise exception 'INVALID_RESPONSE';
  end if;

  if exists (
    select response.question_id
    from jsonb_to_recordset(coalesce(p_responses, '[]'::jsonb))
      as response(question_id uuid, response text)
    group by response.question_id
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_RESPONSE';
  end if;

  if exists (
    select 1
    from public.event_application_questions question
    where question.event_id = p_event_id
      and question.is_required
      and not exists (
        select 1
        from jsonb_to_recordset(coalesce(p_responses, '[]'::jsonb))
          as response(question_id uuid, response text)
        where response.question_id = question.id
          and nullif(btrim(response.response), '') is not null
      )
  ) then
    raise exception 'REQUIRED_RESPONSE_MISSING';
  end if;

  insert into public.event_applications (event_id, user_id)
  values (p_event_id, v_user_id)
  returning id into v_application_id;

  insert into public.event_application_responses (
    event_application_question_id,
    event_application_id,
    response
  )
  select response.question_id, v_application_id, response.response
  from jsonb_to_recordset(coalesce(p_responses, '[]'::jsonb))
    as response(question_id uuid, response text);

  return v_application_id;
end;
$$;

create function public.review_event_application(
  p_application_id uuid,
  p_status public.application_status
)
returns public.event_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid;
  v_application public.event_applications%rowtype;
begin
  select id into v_reviewer_id
  from public.user_info
  where auth_user_id = auth.uid()
    and role_access = 'admin'::public.role_access_enum;

  if v_reviewer_id is null then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'INVALID_REVIEW_STATUS';
  end if;

  select * into v_application
  from public.event_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  if v_application.status not in ('pending', 'rejected') then
    raise exception 'APPLICATION_REVIEW_NOT_ALLOWED';
  end if;

  update public.event_applications
  set
    status = p_status,
    attendance_status = case
      when p_status = 'accepted' then 'awaiting_confirmation'::public.attendance_status
      else null
    end,
    reviewed_at = now(),
    reviewer_id = v_reviewer_id
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

create function public.confirm_free_event_attendance(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_application public.event_applications%rowtype;
  v_event public.events%rowtype;
  v_registration_id uuid;
  v_effective_price numeric;
  v_occupied_count integer;
begin
  select id into v_user_id
  from public.user_info
  where auth_user_id = auth.uid();

  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into v_application
  from public.event_applications
  where id = p_application_id
    and user_id = v_user_id
  for update;

  if not found or v_application.status <> 'accepted' then
    raise exception 'APPLICATION_NOT_AWAITING_CONFIRMATION';
  end if;

  select * into v_event
  from public.events
  where id = v_application.event_id
  for update;

  if v_application.attendance_status = 'confirmed' then
    select id into v_registration_id
    from public.event_registrations
    where application_id = p_application_id;

    if v_registration_id is null then
      raise exception 'CONFIRMED_APPLICATION_MISSING_REGISTRATION';
    end if;

    return v_registration_id;
  end if;

  if v_application.attendance_status <> 'awaiting_confirmation' then
    raise exception 'APPLICATION_NOT_AWAITING_CONFIRMATION';
  end if;

  select case
    when membership_type_id is not null then v_event.member_price
    else v_event.regular_price
  end
  into v_effective_price
  from public.user_info
  where id = v_user_id;

  if v_effective_price <> 0 then
    raise exception 'PAYMENT_REQUIRED';
  end if;

  select
    (select count(*)
     from public.event_registrations
     where event_id = v_application.event_id)
    + (
      select count(*)
      from public.purchases purchase
      where purchase.event_id = v_application.event_id
        and purchase.kind = 'event_ticket'
        and purchase.seat_hold_expires_at > now()
    )
  into v_occupied_count;

  if v_occupied_count >= v_event.max_capacity then
    raise exception 'SOLD_OUT';
  end if;

  insert into public.event_registrations (
    event_id,
    user_id,
    application_id
  )
  values (
    v_application.event_id,
    v_application.user_id,
    v_application.id
  )
  returning id into v_registration_id;

  update public.event_applications
  set attendance_status = 'confirmed'
  where id = p_application_id;

  return v_registration_id;
end;
$$;

create function public.mark_event_application_not_attending(p_application_id uuid)
returns public.event_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid;
  v_application public.event_applications%rowtype;
  v_registration_id uuid;
begin
  select id into v_reviewer_id
  from public.user_info
  where auth_user_id = auth.uid()
    and role_access = 'admin'::public.role_access_enum;

  if v_reviewer_id is null then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_application
  from public.event_applications
  where id = p_application_id
  for update;

  if not found
    or v_application.status <> 'accepted'
    or v_application.attendance_status not in ('awaiting_confirmation', 'confirmed')
  then
    raise exception 'APPLICATION_ATTENDANCE_CHANGE_NOT_ALLOWED';
  end if;

  select id into v_registration_id
  from public.event_registrations
  where application_id = p_application_id
  for update;

  if v_registration_id is not null
    and exists (
      select 1
      from public.check_ins
      where event_registration_id = v_registration_id
    )
  then
    raise exception 'REGISTRATION_HAS_CHECK_INS';
  end if;

  update public.purchases
  set seat_hold_expires_at = null
  where application_id = p_application_id;

  delete from public.event_registrations
  where id = v_registration_id;

  update public.event_applications
  set attendance_status = 'not_attending'
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

-- Submitted questions are immutable. The atomic save wrapper below is the only
-- path allowed to suppress its legacy delete/reinsert when the payload is
-- proven identical to the stored ordered configuration.
create function public.guard_submitted_event_questions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at') is not distinct from
      (to_jsonb(old) - 'updated_at')
    then
      return new;
    end if;

    v_event_id := new.event_id;
  elsif tg_op = 'DELETE' then
    v_event_id := old.event_id;
  else
    v_event_id := new.event_id;
  end if;

  if exists (
    select 1
    from public.event_applications
    where event_id = v_event_id
  ) then
    if tg_op in ('INSERT', 'DELETE')
      and pg_catalog.current_setting(
        'uxhub.allow_unchanged_question_rewrite',
        true
      ) = 'on'
    then
      return null;
    end if;

    raise exception 'EVENT_APPLICATION_QUESTIONS_LOCKED';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger guard_submitted_event_questions_delete
before delete on public.event_application_questions
for each row execute function public.guard_submitted_event_questions();

create trigger guard_submitted_event_questions_insert
before insert on public.event_application_questions
for each row execute function public.guard_submitted_event_questions();

create trigger guard_submitted_event_questions_update
before update on public.event_application_questions
for each row execute function public.guard_submitted_event_questions();

create function public.guard_submitted_event_application_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.applications_enabled is distinct from old.applications_enabled
    and exists (
      select 1
      from public.event_applications
      where event_id = old.id
    )
  then
    raise exception 'EVENT_APPLICATION_MODE_LOCKED';
  end if;

  return new;
end;
$$;

create trigger guard_submitted_event_application_mode
before update on public.events
for each row execute function public.guard_submitted_event_application_mode();

-- Replace the public save entry point while preserving its mature implementation.
alter function public.save_admin_event_atomically(
  uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb
) rename to save_admin_event_atomically_before_application_lifecycle;

create function public.save_admin_event_atomically(
  p_event_id uuid,
  p_event jsonb,
  p_slug text,
  p_expected_image_url text,
  p_check_in_sessions jsonb,
  p_application_questions jsonb,
  p_mentors jsonb,
  p_sponsors jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_questions jsonb;
  v_incoming_questions jsonb;
  v_result jsonb;
begin
  if p_event_id is not null
    and exists (
      select 1
      from public.event_applications
      where event_id = p_event_id
    )
  then
    if (p_event ->> 'applications_enabled')::boolean is distinct from (
      select applications_enabled
      from public.events
      where id = p_event_id
    ) then
      raise exception 'EVENT_APPLICATION_MODE_LOCKED';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'question', question.question,
          'description', question.description,
          'response_type', question.response_type::text,
          'is_required', question.is_required,
          'sort_order', question.sort_order,
          'max_char_limit', question.max_char_limit,
          'response_options', question.response_options,
          'restrict_file_types', question.restrict_file_types,
          'allowed_file_types', question.allowed_file_types,
          'max_file_size_bytes', question.max_file_size_bytes
        )
        order by question.sort_order
      ),
      '[]'::jsonb
    )
    into v_current_questions
    from public.event_application_questions question
    where question.event_id = p_event_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'question', item.question,
          'description', item.description,
          'response_type', item.response_type,
          'is_required', coalesce(item.is_required, false),
          'sort_order', coalesce(item.sort_order, 0),
          'max_char_limit', item.max_char_limit,
          'response_options', item.response_options,
          'restrict_file_types', coalesce(item.restrict_file_types, false),
          'allowed_file_types', item.allowed_file_types,
          'max_file_size_bytes', item.max_file_size_bytes
        )
        order by coalesce(item.sort_order, 0)
      ),
      '[]'::jsonb
    )
    into v_incoming_questions
    from jsonb_to_recordset(coalesce(p_application_questions, '[]'::jsonb))
      as item(
        question text,
        description text,
        response_type text,
        is_required boolean,
        sort_order integer,
        max_char_limit integer,
        response_options text[],
        restrict_file_types boolean,
        allowed_file_types text[],
        max_file_size_bytes bigint
      );

    if v_incoming_questions is distinct from v_current_questions then
      raise exception 'EVENT_APPLICATION_QUESTIONS_LOCKED';
    end if;

    perform pg_catalog.set_config(
      'uxhub.allow_unchanged_question_rewrite',
      'on',
      true
    );
  end if;

  select public.save_admin_event_atomically_before_application_lifecycle(
    p_event_id,
    p_event,
    p_slug,
    p_expected_image_url,
    p_check_in_sessions,
    p_application_questions,
    p_mentors,
    p_sponsors
  )
  into v_result;

  perform pg_catalog.set_config(
    'uxhub.allow_unchanged_question_rewrite',
    'off',
    true
  );

  return v_result;
end;
$$;

-- Rebuild table access around read-only rows plus atomic lifecycle routines.
alter table public.event_applications enable row level security;

create policy "applications: read own"
  on public.event_applications
  for select to authenticated
  using (user_id = public.current_user_info_id());

create policy "applications: admins read all"
  on public.event_applications
  for select to authenticated
  using (public.is_admin());

create policy "application responses: read own"
  on public.event_application_responses
  for select to authenticated
  using (
    exists (
      select 1
      from public.event_applications application
      where application.id = event_application_id
        and application.user_id = public.current_user_info_id()
    )
  );

create policy "application responses: admins read all"
  on public.event_application_responses
  for select to authenticated
  using (public.is_admin());

create policy "application questions: available to applicants"
  on public.event_application_questions
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.event_applications application
      where application.event_id = event_application_questions.event_id
        and application.user_id = public.current_user_info_id()
    )
    or exists (
      select 1
      from public.events event
      where event.id = event_application_questions.event_id
        and event.status = 'active'
        and event.applications_enabled
        and now() >= coalesce(event.registration_start_time, '-infinity'::timestamptz)
        and now() <= coalesce(event.registration_end_time, 'infinity'::timestamptz)
    )
  );

create policy "registrations: read own"
  on public.event_registrations
  for select to authenticated
  using (user_id = public.current_user_info_id());

create policy "registrations: admins read all"
  on public.event_registrations
  for select to authenticated
  using (public.is_admin());

revoke all on table public.event_applications from public, anon, authenticated;
revoke all on table public.event_application_responses from public, anon, authenticated;
revoke all on table public.event_application_questions from public, anon, authenticated;
revoke all on table public.event_registrations from public, anon, authenticated;

grant select on table public.event_applications to authenticated;
grant select on table public.event_application_responses to authenticated;
grant select on table public.event_application_questions to authenticated;
grant select on table public.event_registrations to authenticated;

grant all on table public.event_applications to service_role;
grant all on table public.event_application_responses to service_role;
grant all on table public.event_application_questions to service_role;
grant all on table public.event_registrations to service_role;

revoke all on function public.reserve_paid_event_ticket(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.release_paid_event_ticket_reservation(uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_paid_event_ticket(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_paid_event_ticket(uuid, uuid, uuid)
  to service_role;
grant execute on function public.release_paid_event_ticket_reservation(uuid)
  to service_role;
grant execute on function public.finalize_paid_event_ticket(uuid)
  to service_role;

revoke all on function public.submit_event_application(uuid, jsonb)
  from public, anon;
revoke all on function public.review_event_application(uuid, public.application_status)
  from public, anon;
revoke all on function public.confirm_free_event_attendance(uuid)
  from public, anon;
revoke all on function public.mark_event_application_not_attending(uuid)
  from public, anon;
grant execute on function public.submit_event_application(uuid, jsonb)
  to authenticated;
grant execute on function public.review_event_application(uuid, public.application_status)
  to authenticated;
grant execute on function public.confirm_free_event_attendance(uuid)
  to authenticated;
grant execute on function public.mark_event_application_not_attending(uuid)
  to authenticated;

revoke all on function public.guard_submitted_event_questions()
  from public, anon, authenticated;
revoke all on function public.guard_submitted_event_application_mode()
  from public, anon, authenticated;

revoke all on function public.save_admin_event_atomically_before_application_lifecycle(
  uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_admin_event_atomically_before_application_lifecycle(
  uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;

revoke all on function public.save_admin_event_atomically(
  uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_admin_event_atomically(
  uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;
