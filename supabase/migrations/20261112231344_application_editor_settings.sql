-- Form-only application configuration; attendee release/expiry enforcement
-- remains separate. No existing offers or responses are rewritten.
create table public.event_application_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  decisions_release_at timestamptz,
  confirmation_deadline timestamptz,
  questions_locked_at timestamptz,
  constraint application_timing_order check (
    decisions_release_at is null or confirmation_deadline is null
    or confirmation_deadline > decisions_release_at
  )
);
alter table public.event_application_settings enable row level security;
create policy "staff read application settings" on public.event_application_settings
  for select to authenticated using (public.is_admin());
revoke all on public.event_application_settings from public, anon, authenticated;
grant select on public.event_application_settings to authenticated;
grant all on public.event_application_settings to service_role;
insert into public.event_application_settings(event_id, questions_locked_at)
select event_id, min(coalesce(submitted_at, created_at))
from public.event_applications where status <> 'draft' or submitted_at is not null group by event_id;

-- A durable marker survives subsequent decisions or removal of applications.
create function public.lock_submitted_application_questions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.events where id = new.event_id for update;
  if new.status <> 'draft' then
    insert into public.event_application_settings(event_id, questions_locked_at)
    values(new.event_id, coalesce(new.submitted_at, now()))
    on conflict(event_id) do update
      set questions_locked_at = coalesce(public.event_application_settings.questions_locked_at, excluded.questions_locked_at);
  end if;
  return new;
end $$;
create trigger lock_submitted_application_questions before insert or update on public.event_applications
  for each row execute function public.lock_submitted_application_questions();

-- Direct table requests have the same lock as the form RPC, even when no
-- answer was entered. Parent-event deletion still cascades as before.
create function public.guard_locked_application_question()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event uuid;
begin
  v_event := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  perform 1 from public.events where id = v_event for update;
  if tg_op = 'UPDATE' and old.event_id <> new.event_id then
    raise exception 'An application question cannot change events.' using hint = 'APPLICATION_QUESTIONS_CONFLICT';
  end if;
  if exists(select 1 from public.events where id = v_event)
    and exists(select 1 from public.event_application_settings where event_id = v_event and questions_locked_at is not null)
    and (tg_op <> 'UPDATE' or (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at')) then
    raise exception 'Application questions are locked after the first submitted application. Reload the event form.' using hint = 'APPLICATION_QUESTIONS_CONFLICT';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger guard_locked_application_question before insert or update or delete on public.event_application_questions
  for each row execute function public.guard_locked_application_question();
revoke all on function public.lock_submitted_application_questions(), public.guard_locked_application_question() from public, anon, authenticated;

create or replace function public.save_event_application_questions(
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

  -- Serialize edits with first submission, including applications inserted
  -- concurrently (locking existing application rows cannot cover that case).
  perform 1 from public.events where id = p_event_id for update;

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

  if exists(select 1 from public.event_application_settings where event_id = p_event_id and questions_locked_at is not null) then
    -- Compare supported values before any child writes. Legacy no-id payloads
    -- were resolved above; changed ids, wording, order or settings all refuse.
    if (select count(*) from public.event_application_questions where event_id = p_event_id) <> jsonb_array_length(v_items)
      or exists (
        select 1 from jsonb_array_elements(v_items) with ordinality item(value, position)
        left join public.event_application_questions q on q.id = (item.value->>'id')::uuid and q.event_id = p_event_id
        where q.id is null or (
          q.question, q.description, q.response_type::text, q.is_required,
          q.sort_order, q.max_char_limit, q.response_options
        ) is distinct from (
          item.value->>'question', item.value->>'description', item.value->>'response_type',
          coalesce((item.value->>'is_required')::boolean, false),
          coalesce((item.value->>'sort_order')::integer, (item.position - 1)::integer),
          (item.value->>'max_char_limit')::integer,
          case when jsonb_typeof(item.value->'response_options') = 'array' then array(select jsonb_array_elements_text(item.value->'response_options')) end
        )
      ) then
      raise exception 'Application questions are locked after the first submitted application. Reload the event form.' using hint = 'APPLICATION_QUESTIONS_CONFLICT';
    end if;
    return jsonb_build_object('question_ids', (select coalesce(jsonb_agg(value->'id' order by position), '[]') from jsonb_array_elements(v_items) with ordinality item(value, position)), 'removed_files', '[]'::jsonb);
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


create or replace function public.submit_event_application(p_application_id uuid)
returns table (status text, missing_question_ids uuid[])
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_application public.event_applications%rowtype;
  v_event       public.events%rowtype;
  v_missing     uuid[];
begin
  -- Acquire the editor's event lock before reading questions or locking the
  -- application. Validate against the question set that this submission locks.
  perform 1 from public.events where id = (
    select event_id from public.event_applications
    where id = p_application_id and user_id = public.current_user_info_id()
  ) for update;
  select * into v_application
  from public.event_applications application
  where application.id = p_application_id
    and application.user_id = public.current_user_info_id()
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, '{}'::uuid[];
    return;
  end if;

  if v_application.status <> 'draft' then
    return query select 'NOT_DRAFT'::text, '{}'::uuid[];
    return;
  end if;

  select * into v_event
  from public.events event
  where event.id = v_application.event_id;

  if not v_event.requires_application
     or not (public.event_is_public(v_event.status, v_event.publish_at) or public.is_admin()) then
    return query select 'NOT_ACCEPTING_APPLICATIONS'::text, '{}'::uuid[];
    return;
  end if;

  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    return query select 'REGISTRATION_NOT_OPEN'::text, '{}'::uuid[];
    return;
  end if;

  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    return query select 'REGISTRATION_CLOSED'::text, '{}'::uuid[];
    return;
  end if;

  select coalesce(array_agg(question.id order by question.sort_order, question.created_at, question.id), '{}')
  into v_missing
  from public.event_application_questions question
  left join public.event_application_responses response
    on response.event_application_question_id = question.id
   and response.application_id = v_application.id
  cross join lateral (
    select nullif(btrim(coalesce(response.response, '')), '') as answer
  ) answer
  where question.event_id = v_event.id
    and (
      -- Missing: nothing, whitespace, or an empty checkbox selection.
      (
        question.is_required
        and (
          answer.answer is null
          or (question.response_type = 'checkbox' and answer.answer ~ '^\[\s*\]$')
        )
      )
      -- Too long.
      or (
        answer.answer is not null
        and question.max_char_limit is not null
        and question.response_type in ('short_text', 'long_text')
        and char_length(response.response) > question.max_char_limit
      )
      -- A file answer must be an object this applicant uploaded for it.
      or (
        answer.answer is not null
        and question.response_type = 'file_upload'
        and not exists (
          select 1
          from storage.objects object
          where object.bucket_id = 'application-files'
            and object.name = response.response
            and starts_with(
              object.name,
              v_application.user_id::text || '/' || v_application.id::text || '/'
                || question.id::text || '/'
            )
        )
      )
    );

  if cardinality(v_missing) > 0 then
    return query select 'INCOMPLETE'::text, v_missing;
    return;
  end if;

  perform set_config('uxhub.submitting_application', 'on', true);
  update public.event_applications application
  set status = 'submitted', submitted_at = now()
  where application.id = v_application.id;
  perform set_config('uxhub.submitting_application', 'off', true);

  return query select 'SUBMITTED'::text, '{}'::uuid[];
end;
$$;

revoke all on function public.submit_event_application(uuid) from public, anon;
grant execute on function public.submit_event_application(uuid) to authenticated, service_role;

-- Extend the current date/location wrapper and preserve every existing save
-- precondition. Missing configuration keys from older clients preserve values.
alter function public.save_admin_event_atomically(uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb)
rename to save_admin_event_before_application_settings;
create function public.save_admin_event_atomically(
  p_event_id uuid, p_event jsonb, p_slug text, p_expected_image_url text,
  p_check_in_sessions jsonb, p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare v_result jsonb; v_id uuid; v_event public.events; v_timing jsonb;
begin
  if p_event_id is not null then perform 1 from public.events where id = p_event_id for update; end if;
  v_result := public.save_admin_event_before_application_settings(p_event_id, p_event, p_slug, p_expected_image_url, p_check_in_sessions, p_application_questions, p_mentors, p_sponsors);
  v_id := (v_result->>'id')::uuid;
  v_timing := p_event->'_application_timing';
  if v_timing is not null then
    if jsonb_typeof(v_timing) <> 'object' then
      raise exception 'Invalid application timing settings.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    insert into public.event_application_settings(event_id, decisions_release_at, confirmation_deadline)
    values(v_id, (v_timing->>'decisions_release_at')::timestamptz, (v_timing->>'confirmation_deadline')::timestamptz)
    on conflict(event_id) do update set decisions_release_at = excluded.decisions_release_at, confirmation_deadline = excluded.confirmation_deadline;
  end if;
  select * into v_event from public.events where id = v_id;
  if v_event.requires_application and (v_event.status = 'active' or v_event.publish_at is not null) then
    if not exists(select 1 from public.event_application_questions where event_id = v_id) or exists(
      select 1 from public.event_application_questions q where q.event_id = v_id and (
        nullif(btrim(q.question), '') is null
        or (q.response_type in ('short_text', 'long_text') and q.max_char_limit is not null and q.max_char_limit <= 0)
        or (q.response_type in ('checkbox', 'multiple_choice', 'dropdown') and (coalesce(cardinality(q.response_options), 0) = 0 or exists(select 1 from unnest(q.response_options) option where nullif(btrim(option), '') is null)))
      )
    ) then
      raise exception 'Applications require at least one valid question before publication.' using hint = 'APPLICATION_QUESTIONS_CONFLICT';
    end if;
  end if;
  return v_result;
exception when check_violation then
  if sqlerrm like '%application_timing_order%' then
    raise exception 'Confirm by must be later than Release decisions on.' using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  raise;
end $$;
revoke all on function public.save_admin_event_atomically(uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_admin_event_atomically(uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;
