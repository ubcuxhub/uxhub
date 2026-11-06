-- Admin event saves keep check-in sessions, and so their check-ins.
--
-- save_admin_event_atomically used to delete every check_in_sessions row of
-- the event and insert the payload again, so each save gave every session a
-- new id and, through check_ins.check_in_session_id's ON DELETE CASCADE,
-- deleted every check-in of the event, even mid-event. Now the sessions are
-- saved by id (save_event_check_in_sessions):
--
--   - an item with an id updates that session, one with a null id is new,
--     and a session the payload leaves out is removed;
--   - a session anyone has checked in to cannot be removed. Its name and
--     times can still change; the check-ins stay with it.
--
-- Refusals carry the hint CHECK_IN_SESSIONS_CONFLICT and a message meant for
-- the admin. The result gains check_in_session_ids, in payload order.
--
-- Backward compatible with the builder in production, which sends no ids: an
-- item without an id key keeps the id of the session at the same position
-- (the builder lists them by start_time) when its name, start_time and
-- end_time are unchanged. A save that leaves the sessions alone, the usual
-- case, therefore keeps every check-in. One that edits or removes a session
-- replaces it, as before, unless it has check-ins, which refuses the save.

set search_path = '';

-- ── save_event_check_in_sessions ────────────────────────────────────────────

create function public.save_event_check_in_sessions(
  p_event_id uuid,
  p_sessions jsonb
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
begin
  if jsonb_typeof(coalesce(p_sessions, '[]'::jsonb)) <> 'array' then
    raise exception 'Check-in sessions must be an array.';
  end if;

  -- Every item with its id: its own when it has the key, otherwise
  -- (the production builder) the session at the same position, in the order
  -- that builder loads them, with the same name and times, or null.
  with existing as (
    select
      session.id,
      session.name,
      session.start_time,
      session.end_time,
      row_number() over (
        order by session.start_time, session.created_at, session.id
      ) as position
    from public.check_in_sessions session
    where session.event_id = p_event_id
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
  from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb))
    with ordinality as item(value, position)
  left join existing legacy
    on not (item.value ? 'id')
   and legacy.position = item.position
   and legacy.name = item.value ->> 'name'
   and legacy.start_time is not distinct from (item.value ->> 'start_time')::timestamptz
   and legacy.end_time is not distinct from (item.value ->> 'end_time')::timestamptz;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where item.value ->> 'id' is not null
    group by (item.value ->> 'id')::uuid
    having count(*) > 1
  ) then
    raise exception 'The same check-in session was sent more than once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where item.value ->> 'id' is not null
      and not exists (
        select 1
        from public.check_in_sessions session
        where session.id = (item.value ->> 'id')::uuid
          and session.event_id = p_event_id
      )
  ) then
    raise exception 'A check-in session was changed somewhere else since this page loaded. Reload the page and apply your changes again.'
      using hint = 'CHECK_IN_SESSIONS_CONFLICT';
  end if;

  -- Lock the sessions this save removes before looking for their check-ins.
  -- A check-in being recorded holds a key-share lock on its session, so this
  -- waits for it to commit, and one recorded after it waits for this save,
  -- then fails on the missing session instead of being cascaded away
  -- unseen.
  perform 1
  from public.check_in_sessions session
  where session.event_id = p_event_id
    and not exists (
      select 1
      from jsonb_array_elements(v_items) as item(value)
      where (item.value ->> 'id')::uuid = session.id
    )
  for update;

  select session.name
  into v_conflict
  from public.check_in_sessions session
  where session.event_id = p_event_id
    and not exists (
      select 1
      from jsonb_array_elements(v_items) as item(value)
      where (item.value ->> 'id')::uuid = session.id
    )
    and exists (
      select 1
      from public.check_ins check_in
      where check_in.check_in_session_id = session.id
    )
  order by session.start_time, session.created_at, session.id
  limit 1;

  if found then
    raise exception 'Attendees have already checked in to "%", so it cannot be removed.', v_conflict
      using hint = 'CHECK_IN_SESSIONS_CONFLICT';
  end if;

  delete from public.check_in_sessions session
  where session.event_id = p_event_id
    and not exists (
      select 1
      from jsonb_array_elements(v_items) as item(value)
      where (item.value ->> 'id')::uuid = session.id
    );

  for v_item in
    select item.position, session.id, session.name, session.start_time, session.end_time
    from jsonb_array_elements(v_items) with ordinality as item(value, position)
    cross join lateral pg_catalog.jsonb_populate_record(
      null::public.check_in_sessions,
      item.value
    ) as session
    order by item.position
  loop
    if v_item.id is null then
      insert into public.check_in_sessions (event_id, name, start_time, end_time)
      values (p_event_id, v_item.name, v_item.start_time, v_item.end_time)
      returning id into v_id;
    else
      -- Only a changed row is written, so updated_at means something.
      update public.check_in_sessions existing
      set name = v_item.name,
          start_time = v_item.start_time,
          end_time = v_item.end_time
      where existing.id = v_item.id
        and (existing.name, existing.start_time, existing.end_time)
          is distinct from (v_item.name, v_item.start_time, v_item.end_time);
      v_id := v_item.id;
    end if;

    v_ids := v_ids || v_id;
  end loop;

  return jsonb_build_object('check_in_session_ids', to_jsonb(v_ids));
end;
$$;

revoke all on function public.save_event_check_in_sessions(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_event_check_in_sessions(uuid, jsonb)
  to service_role;

-- ── save_admin_event_atomically ─────────────────────────────────────────────
--
-- As in 20261106195303, except that check-in sessions are saved by
-- save_event_check_in_sessions instead of being deleted and inserted again,
-- and the result includes what it returns.

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
  v_sessions jsonb;
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
  end if;

  v_sessions := public.save_event_check_in_sessions(
    v_event_id,
    p_check_in_sessions
  );

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

  return jsonb_build_object('id', v_event_id) || v_sessions || v_questions;
end;
$$;
