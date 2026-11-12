-- Qualify the full row: bare "question" resolves to the text column,
-- making JSON key removal fail for every event with application questions.
CREATE OR REPLACE FUNCTION public.save_admin_event_atomically(p_event_id uuid, p_event jsonb, p_slug text, p_expected_image_url text, p_check_in_sessions jsonb, p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_event_id uuid;
  v_columns text;
  v_image_changed boolean;
  v_mentor_section_id uuid;
  v_keep_sessions boolean := false;
  v_keep_questions boolean := false;
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


    select coalesce(jsonb_agg(to_jsonb(incoming) order by incoming.start_time, incoming.name, incoming.end_time), '[]'::jsonb)
      = coalesce((select jsonb_agg(jsonb_build_object('name', session.name, 'start_time', session.start_time, 'end_time', session.end_time) order by session.start_time, session.name, session.end_time)
        from public.check_in_sessions session where session.event_id = v_event_id), '[]'::jsonb)
    into v_keep_sessions from jsonb_to_recordset(p_check_in_sessions) as incoming(name text, start_time timestamptz, end_time timestamptz);
    select coalesce(jsonb_agg(to_jsonb(incoming) - 'id' - 'event_id' - 'created_at' - 'updated_at' order by incoming.sort_order), '[]'::jsonb)
      = coalesce((select jsonb_agg(to_jsonb(question.*) - 'id' - 'event_id' - 'created_at' - 'updated_at' order by question.sort_order)
        from public.event_application_questions question where question.event_id = v_event_id), '[]'::jsonb)
    into v_keep_questions from jsonb_populate_recordset(null::public.event_application_questions, p_application_questions) as incoming;
    if not v_keep_sessions and exists(select 1 from public.check_ins attendance join public.check_in_sessions session on session.id = attendance.check_in_session_id where session.event_id = v_event_id) then
      raise exception 'Check-in sessions with attendance cannot be replaced.';
    end if;
    if not v_keep_questions and exists(select 1 from public.event_application_responses response join public.event_application_questions question on question.id = response.event_application_question_id where question.event_id = v_event_id) then
      raise exception 'Application questions with responses cannot be replaced.';
    end if;
    if not v_keep_sessions then delete from public.check_in_sessions where event_id = v_event_id; end if;
    if not v_keep_questions then delete from public.event_application_questions where event_id = v_event_id; end if;
  end if;

  if not v_keep_sessions then
  insert into public.check_in_sessions (event_id, name, start_time, end_time)
  select
    v_event_id,
    item.name,
    item.start_time,
    item.end_time
  from jsonb_to_recordset(coalesce(p_check_in_sessions, '[]'::jsonb))
    as item(name text, start_time timestamptz, end_time timestamptz);

  end if;
  if not v_keep_questions then
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

  end if;
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

  -- This form knows only mentors, so p_mentors is the event's Mentors
  -- section, made on first use and placed after any other. Sections it
  -- doesn't know, like Judges, are left alone.
  select section.id
  into v_mentor_section_id
  from public.event_people_sections section
  where section.event_id = v_event_id
    and lower(btrim(section.title)) = 'mentors';

  if v_mentor_section_id is null
    and jsonb_array_length(coalesce(p_mentors, '[]'::jsonb)) > 0 then
    insert into public.event_people_sections (event_id, title, sort_order)
    select
      v_event_id,
      'Mentors',
      coalesce(max(section.sort_order) + 1, 0)
    from public.event_people_sections section
    where section.event_id = v_event_id
    returning id into v_mentor_section_id;
  end if;

  insert into public.event_mentors (event_id, section_id, mentor_id, sort_order)
  select
    v_event_id,
    v_mentor_section_id,
    selected.mentor_id::uuid,
    selected.ordinality - 1
  from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb))
    with ordinality as selected(mentor_id, ordinality)
  on conflict (section_id, mentor_id)
  do update set sort_order = excluded.sort_order;

  delete from public.event_mentors event_mentor
  where event_mentor.section_id = v_mentor_section_id
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
$function$;
