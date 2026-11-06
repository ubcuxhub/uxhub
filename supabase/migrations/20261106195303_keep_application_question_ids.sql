-- Admin event saves keep application questions, and so their answers.
--
-- save_admin_event_atomically used to delete every event_application_questions
-- row of the event and insert the payload again, so each save gave every
-- question a new id and cascaded away every response, drafts and submitted
-- applications alike, and left uploaded files under question ids that no
-- longer existed. Now the questions are saved by id
-- (save_event_application_questions):
--
--   - an item with an id updates that question, one with a null id is new,
--     and a question the payload leaves out is removed;
--   - a question with answers on a submitted application cannot be removed;
--   - a question with any answer, draft or submitted, cannot change its
--     response_type, since the answers would no longer fit it;
--   - file questions take one PDF of at most 5 MB, the application-files
--     bucket's limits (20261106193115), whatever the payload says.
--
-- Refusals carry the hint APPLICATION_QUESTIONS_CONFLICT and a message meant
-- for the admin. The result gains question_ids, in payload order, and
-- removed_files, the storage keys answering removed file questions, which the
-- caller deletes from the bucket.
--
-- Backward compatible with the builder in production, which sends no ids: an
-- item without an id key keeps the id of the question at the same position
-- when its text and response_type are unchanged. A save that leaves the
-- questions alone, the usual case, therefore keeps every answer. One that
-- rewords or removes a question replaces it, as before, unless it has
-- submitted answers, which refuses the save.

set search_path = '';

-- ── File questions follow the bucket ────────────────────────────────────────

update public.event_application_questions
set restrict_file_types = true,
    allowed_file_types = array['pdf'],
    max_file_size_bytes = 5242880
where response_type = 'file_upload'
  and (restrict_file_types, allowed_file_types, max_file_size_bytes)
    is distinct from (true, array['pdf'], 5242880::bigint);

-- ── save_event_application_questions ────────────────────────────────────────

create function public.save_event_application_questions(
  p_event_id uuid,
  p_questions jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_items jsonb;
  v_item record;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_conflict text;
  v_removed_files text[];
begin
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array' then
    raise exception 'Application questions must be an array.';
  end if;

  -- Submitting locks the application row, so holding these until commit
  -- keeps a draft from becoming submitted between the checks below and the
  -- writes they allow.
  perform 1
  from public.event_applications application
  where application.event_id = p_event_id
  for share;

  -- Every item with its id: its own when it has the key, otherwise
  -- (the production builder) the question at the same position with the same
  -- text and type, or null.
  with existing as (
    select
      question.id,
      question.question,
      question.response_type::text as response_type,
      row_number() over (
        order by question.sort_order, question.created_at, question.id
      ) as position
    from public.event_application_questions question
    where question.event_id = p_event_id
  )
  select coalesce(
    jsonb_agg(
      item.value || jsonb_build_object(
        'id',
        case when item.value ? 'id' then item.value -> 'id' else to_jsonb(legacy.id) end
      )
      order by item.position
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb))
    with ordinality as item(value, position)
  left join existing legacy
    on not (item.value ? 'id')
   and legacy.position = item.position
   and legacy.question = item.value ->> 'question'
   and legacy.response_type = item.value ->> 'response_type';

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where item.value ->> 'id' is not null
    group by (item.value ->> 'id')::uuid
    having count(*) > 1
  ) then
    raise exception 'The same application question was sent more than once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where item.value ->> 'id' is not null
      and not exists (
        select 1
        from public.event_application_questions question
        where question.id = (item.value ->> 'id')::uuid
          and question.event_id = p_event_id
      )
  ) then
    raise exception 'An application question was changed somewhere else since this page loaded. Reload the page and apply your changes again.'
      using hint = 'APPLICATION_QUESTIONS_CONFLICT';
  end if;

  -- Removing a question deletes its answers, so one that applicants have
  -- submitted answers to stays. Draft answers go with it.
  select question.question
  into v_conflict
  from public.event_application_questions question
  where question.event_id = p_event_id
    and not exists (
      select 1
      from jsonb_array_elements(v_items) as item(value)
      where (item.value ->> 'id')::uuid = question.id
    )
    and exists (
      select 1
      from public.event_application_responses response
      join public.event_applications application
        on application.id = response.application_id
      where response.event_application_question_id = question.id
        and application.status <> 'draft'
        and nullif(btrim(response.response), '') is not null
        and not (question.response_type = 'checkbox' and response.response ~ '^\s*\[\s*\]\s*$')
    )
  order by question.sort_order, question.created_at, question.id
  limit 1;

  if found then
    raise exception '"%" has answers on submitted applications, so it cannot be removed. Reword it or make it optional instead.', v_conflict
      using hint = 'APPLICATION_QUESTIONS_CONFLICT';
  end if;

  -- An answer is stored as text in its type's encoding (a checkbox's is a
  -- JSON array, a file's a storage key), so a new type would misread it.
  select question.question
  into v_conflict
  from jsonb_array_elements(v_items) with ordinality as item(value, position)
  join public.event_application_questions question
    on question.id = (item.value ->> 'id')::uuid
  where question.response_type::text is distinct from item.value ->> 'response_type'
    and exists (
      select 1
      from public.event_application_responses response
      where response.event_application_question_id = question.id
        and nullif(btrim(response.response), '') is not null
        and not (question.response_type = 'checkbox' and response.response ~ '^\s*\[\s*\]\s*$')
    )
  order by item.position
  limit 1;

  if found then
    raise exception '"%" already has answers, so its response type cannot change. Add a new question instead.', v_conflict
      using hint = 'APPLICATION_QUESTIONS_CONFLICT';
  end if;

  -- What remains are draft answers. Their files would be orphaned, so the
  -- caller removes them.
  select coalesce(array_agg(response.response order by response.response), '{}')
  into v_removed_files
  from public.event_application_responses response
  join public.event_application_questions question
    on question.id = response.event_application_question_id
  where question.event_id = p_event_id
    and question.response_type = 'file_upload'
    and nullif(btrim(response.response), '') is not null
    and not exists (
      select 1
      from jsonb_array_elements(v_items) as item(value)
      where (item.value ->> 'id')::uuid = question.id
    );

  delete from public.event_application_questions question
  where question.event_id = p_event_id
    and not exists (
      select 1
      from jsonb_array_elements(v_items) as item(value)
      where (item.value ->> 'id')::uuid = question.id
    );

  for v_item in
    select
      item.position,
      question.id,
      question.question,
      question.description,
      question.response_type,
      coalesce(question.is_required, false) as is_required,
      coalesce(question.sort_order, (item.position - 1)::integer) as sort_order,
      question.max_char_limit,
      question.response_options,
      question.response_type = 'file_upload' as is_file
    from jsonb_array_elements(v_items) with ordinality as item(value, position)
    cross join lateral pg_catalog.jsonb_populate_record(
      null::public.event_application_questions,
      item.value
    ) as question
    order by item.position
  loop
    if v_item.id is null then
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
      values (
        p_event_id,
        v_item.question,
        v_item.description,
        v_item.response_type,
        v_item.is_required,
        v_item.sort_order,
        v_item.max_char_limit,
        v_item.response_options,
        v_item.is_file,
        case when v_item.is_file then array['pdf'] end,
        case when v_item.is_file then 5242880 end
      )
      returning id into v_id;
    else
      -- Only a changed row is written, so updated_at means something.
      update public.event_application_questions existing
      set question = v_item.question,
          description = v_item.description,
          response_type = v_item.response_type,
          is_required = v_item.is_required,
          sort_order = v_item.sort_order,
          max_char_limit = v_item.max_char_limit,
          response_options = v_item.response_options,
          restrict_file_types = v_item.is_file,
          allowed_file_types = case when v_item.is_file then array['pdf'] end,
          max_file_size_bytes = case when v_item.is_file then 5242880 end
      where existing.id = v_item.id
        and (
          existing.question,
          existing.description,
          existing.response_type,
          existing.is_required,
          existing.sort_order,
          existing.max_char_limit,
          existing.response_options,
          existing.restrict_file_types,
          existing.allowed_file_types,
          existing.max_file_size_bytes
        ) is distinct from (
          v_item.question,
          v_item.description,
          v_item.response_type,
          v_item.is_required,
          v_item.sort_order,
          v_item.max_char_limit,
          v_item.response_options,
          v_item.is_file,
          case when v_item.is_file then array['pdf'] end,
          case when v_item.is_file then 5242880::bigint end
        );
      v_id := v_item.id;
    end if;

    v_ids := v_ids || v_id;
  end loop;

  return jsonb_build_object(
    'question_ids', to_jsonb(v_ids),
    'removed_files', to_jsonb(v_removed_files)
  );
end;
$$;

revoke all on function public.save_event_application_questions(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_event_application_questions(uuid, jsonb)
  to service_role;

-- ── save_admin_event_atomically ─────────────────────────────────────────────
--
-- As in 20261028223807, except that application questions are saved by
-- save_event_application_questions instead of being deleted and inserted
-- again, and the result includes what it returns.

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
  v_questions jsonb;
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
  end if;

  insert into public.check_in_sessions (event_id, name, start_time, end_time)
  select
    v_event_id,
    item.name,
    item.start_time,
    item.end_time
  from jsonb_to_recordset(coalesce(p_check_in_sessions, '[]'::jsonb))
    as item(name text, start_time timestamptz, end_time timestamptz);

  v_questions := public.save_event_application_questions(
    v_event_id,
    p_application_questions
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

  return jsonb_build_object('id', v_event_id) || v_questions;
end;
$$;
