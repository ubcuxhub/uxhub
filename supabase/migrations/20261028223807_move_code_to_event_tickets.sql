-- Step 2 of docs/registration-rollout.md: the code moves to event_tickets and
-- event_applications. This runs first, while step 1's code is still live, so
-- everything here also works for that code.
--
--   - re-runs the backfill to pick up registrations written since step 1;
--   - check-ins and application responses no longer need a registration;
--   - their ticket and application keys become full unique constraints, so
--     the code can upsert on them;
--   - check-in pages subscribe to event_tickets;
--   - save_admin_event_atomically writes only the columns its payload names;
--   - release_event_ticket undoes a reservation whose payment did not go
--     through, as release_paid_event_ticket_reservation does for registrations.

select public.backfill_event_tickets_and_applications();

-- ── Check-ins and responses without a registration ──────────────────────
--
-- Step 3 makes ticket_id and application_id not null and drops these columns.

alter table public.check_ins
  alter column event_registration_id drop not null;
alter table public.event_application_responses
  alter column event_registration_id drop not null;

-- 20270101000003 and 04 made these partial (where ... is not null), which
-- on conflict cannot target without repeating the predicate. Nulls never
-- conflict in a plain unique constraint either, so the rows it allows are the
-- same.
drop index public.check_ins_ticket_id_session_id_key;
alter table public.check_ins
  add constraint check_ins_ticket_id_check_in_session_id_key
    unique (ticket_id, check_in_session_id);

drop index public.event_application_responses_question_id_application_id_key;
alter table public.event_application_responses
  add constraint event_application_responses_question_id_application_id_key
    unique (event_application_question_id, application_id);

-- ── Realtime ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_catalog.pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'event_tickets'
     ) then
    alter publication supabase_realtime add table public.event_tickets;
  end if;
end;
$$;

-- ── release_event_ticket ─────────────────────────────────────────────────
--
-- Checkout authorizes the card, reserves the ticket, then captures. When the
-- capture or the hold fails, this frees the seat again. A completed purchase
-- keeps its ticket, and so does one somebody already checked in with.

create function public.release_event_ticket(p_purchase_id uuid)
returns void
language sql set search_path = '' as $$
  delete from public.event_tickets ticket
  using public.purchases purchase
  where ticket.purchase_id = p_purchase_id
    and purchase.id = ticket.purchase_id
    and purchase.status <> 'completed'
    and not exists (
      select 1
      from public.check_ins check_in
      where check_in.ticket_id = ticket.id
    );
$$;

revoke all on function public.release_event_ticket(uuid) from public, anon, authenticated;
grant execute on function public.release_event_ticket(uuid) to service_role;

-- ── save_admin_event_atomically ──────────────────────────────────────────
--
-- Writes an events column only when p_event has its key, so the deployed form
-- (legacy dates, applications_enabled) and the next one (starts_at, ends_at,
-- registration_opens_at, registration_closes_at, requires_application) both
-- save, and a column missing from the payload keeps its value, or its default
-- on create. sync_legacy_event_columns fills in whichever set a form leaves
-- out. Any events column is accepted, so dropping the legacy columns in step 3
-- needs no change here.
--
-- As in 20270101000005 and 20261027230345 otherwise: an explicit null
-- publish_at clears the schedule, a missing one keeps it, and the cover image
-- is written only when it changed and the row still has the image the form
-- loaded with.

create or replace function public.save_admin_event_atomically(
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
  v_event_id uuid;
  v_columns text;
  v_image_changed boolean;
begin
  -- The payload's keys that name a writable events column, quoted. id and
  -- updated_at are the table's own; slug is set once, on create.
  select string_agg(pg_catalog.quote_ident(attribute.attname), ', ' order by attribute.attnum)
  into v_columns
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.events'::pg_catalog.regclass
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attname not in ('id', 'slug', 'updated_at', 'image_url')
    and p_event ? attribute.attname;

  if p_event_id is null then
    -- jsonb_populate_record casts each value to its column's type.
    execute format(
      'insert into public.events (%1$s) '
      'select %1$s from pg_catalog.jsonb_populate_record(null::public.events, $1) '
      'returning id',
      concat_ws(', ', v_columns, 'slug', case when p_event ? 'image_url' then 'image_url' end)
    )
    into v_event_id
    using p_event || jsonb_build_object('slug', p_slug);
  else
    v_image_changed := p_event ? 'image_url'
      and (p_event ->> 'image_url') is distinct from p_expected_image_url;

    -- A save that leaves the cover alone leaves the column alone too: writing
    -- the loaded value back would revert a replacement made elsewhere to a URL
    -- whose object that replacement already deleted. Changing the cover
    -- deletes the old object, so that write is conditional on the row still
    -- holding the image this form loaded with.
    execute format(
      'update public.events event set %s '
      'image_url = case when $2 then $1 ->> ''image_url'' else event.image_url end '
      'where event.id = $3 '
      '  and (not $2 or event.image_url is not distinct from $4) '
      'returning event.id',
      case
        when v_columns is null then ''
        else format(
          '(%1$s) = (select %1$s from pg_catalog.jsonb_populate_record(null::public.events, $1)), ',
          v_columns
        )
      end
    )
    into v_event_id
    using p_event, v_image_changed, p_event_id, p_expected_image_url;

    if v_event_id is null then
      if exists (select 1 from public.events where id = p_event_id) then
        -- Matched by the caller, which turns it into a reload prompt.
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

