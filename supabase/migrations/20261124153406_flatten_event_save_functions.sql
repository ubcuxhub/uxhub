-- One function per event save operation.
--
-- Each feature migration renamed the live save function and wrapped it, so an
-- admin save ran through eleven plpgsql layers spread over a dozen migrations:
--
--   save_admin_event_builder
--     -> _builder_before_agenda_timing -> _builder_before_cancellation
--     -> _builder_before_unified_drafts -> _builder_before_safe_mutations
--     -> _builder_before_publication
--     -> save_admin_event_atomically
--       -> save_admin_event_before_content -> _before_application_settings
--       -> _before_agenda -> _before_date_locations
--
-- and delete_event_atomically wrapped delete_event_before_safe_mutations.
--
-- This migration flattens each chain into the public function with the same
-- signature the app calls (save_admin_event_builder, save_admin_event_atomically,
-- delete_event_atomically), in the order the layers ran, then drops the
-- wrapped layers. Behaviour is unchanged, with one exception: the saves no
-- longer mirror the online meeting details into `event_private_details`.
-- Nothing reads that table (pages read meeting details from
-- `event_date_location_settings`), so it is now retired; a follow-up migration
-- drops it once no deployed code references it.
--
-- `create or replace` keeps each function's owner and grants (service_role
-- only). The builder's idempotency receipts (`admin_event_mutations.request`)
-- are built exactly as before, so a retry recorded by the old functions still
-- replays.

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
set search_path = ''
as $function$
declare
  -- People and resources (`_content`).
  v_content jsonb := p_event->'_content';
  v_content_revision integer;
  v_section jsonb;
  v_entry jsonb;
  v_link jsonb;
  v_section_id uuid;
  v_entry_id uuid;
  v_position integer;
  v_section_position integer := 0;
  v_mentor public.mentors;
  v_sponsor public.sponsors;
  v_item_links jsonb;
  -- Dates, locations and the agenda (`_date_location`).
  v_config jsonb := p_event->'_date_location';
  v_existing public.event_date_location_settings;
  v_day jsonb;
  v_item jsonb;
  v_location jsonb;
  v_day_location jsonb;
  v_days jsonb := '[]';
  v_items jsonb;
  v_sessions jsonb := '[]';
  v_index integer := 0;
  v_key uuid;
  v_all_keys uuid[] := '{}';
  v_day_ids uuid[] := '{}';
  v_item_ids uuid[] := '{}';
  v_session_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_item_start timestamptz;
  v_item_end timestamptz;
  -- The event row and its child lists.
  v_event_id uuid;
  v_columns text;
  v_image_changed boolean;
  v_saved_sessions jsonb;
  v_saved_questions jsonb;
  v_mentor_section_id uuid;
  v_timing jsonb;
  v_saved public.events;
  v_result jsonb;
begin
  if p_event_id is not null then
    perform 1 from public.events where id = p_event_id for update;
  end if;

  -- 1. People and resources. When the builder's content editor sends
  -- `_content`, it owns the event's people sections, sponsors and links,
  -- written after the event below. Until then the event keeps its current
  -- mentor and sponsor links.
  if v_content is not null then
    perform public.validate_event_content(v_content);
    if p_event_id is not null then
      select revision into v_content_revision
      from public.event_content_settings where event_id = p_event_id;
      if coalesce(v_content_revision, 0) <> coalesce((v_content->>'revision')::integer, 0) then
        raise exception 'People or resources changed in another tab. Reload before saving.' using hint = 'EVENT_CONTENT_INVALID';
      end if;
    end if;
    select coalesce(jsonb_agg(mentor_id order by sort_order), '[]') into p_mentors
    from public.event_mentors
    where event_id = p_event_id
      and section_id in (
        select id from public.event_people_sections
        where event_id = p_event_id and lower(btrim(title)) = 'mentors'
      );
    select coalesce(jsonb_agg(sponsor_id order by sort_order), '[]') into p_sponsors
    from public.event_sponsors where event_id = p_event_id;
    p_event := (p_event - '_content') || jsonb_build_object(
      'mentors_enabled', exists(select 1 from jsonb_array_elements(v_content->'sections') s where s->>'kind' <> 'Sponsors'),
      'sponsors_enabled', exists(select 1 from jsonb_array_elements(v_content->'sections') s where s->>'kind' = 'Sponsors'));
  end if;

  begin
    if p_event_id is not null then
      select * into v_existing from public.event_date_location_settings where event_id = p_event_id;
    end if;

    -- 2. Dates and locations: validate the settings and derive the event's
    -- envelope, location columns and check-in sessions from them.
    if v_config->>'version' = '2' then
      -- The agenda: days of items, each item optionally checked in.
      if coalesce((p_event->>'_date_revision')::integer, 0) <> coalesce(v_existing.revision, 0) then
        raise exception 'Agenda changed in another tab. Reload before saving.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      if coalesce(v_config->>'audience', '') not in ('everyone', 'going') or jsonb_typeof(v_config->'dates') is distinct from 'array'
        or jsonb_array_length(v_config->'dates') not between 1 and 100 then
        raise exception 'Add valid agenda days and locations.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      for v_day in select value from jsonb_array_elements(v_config->'dates') loop
        v_key := (v_day->>'key')::uuid;
        if v_key is null or v_key = any(v_all_keys) or coalesce(btrim(v_day->>'label'), '') = '' or jsonb_typeof(v_day->'items') is distinct from 'array' or jsonb_array_length(v_day->'items') not between 1 and 500 then
          raise exception 'Every day needs its own identity, a label and at least one item.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
        v_all_keys := array_append(v_all_keys, v_key);
        v_day_ids := array_append(v_day_ids, v_key);
        if exists(select 1 from public.event_agenda_days where id = v_key and event_id is distinct from p_event_id) then
          raise exception 'Agenda day belongs to another event.';
        end if;
        v_day_start := null;
        v_day_end := null;
        v_items := '[]';
        v_day_location := v_day->'location';
        for v_location in select v_day_location union all select value->'location' from jsonb_array_elements(v_day->'items') where value->'location' <> 'null'::jsonb loop
          if coalesce(v_location->>'type', '') not in ('in_person', 'online', 'hybrid') then
            raise exception 'Choose a day or item location type.' using hint = 'EVENT_SETTINGS_CONFLICT';
          end if;
          if v_location->>'type' <> 'online' and (coalesce(btrim(v_location->>'building'), '') = '' or coalesce(btrim(v_location->>'address'), '') = '') then
            raise exception 'In-person locations require a building and street address.' using hint = 'EVENT_SETTINGS_CONFLICT';
          end if;
          if v_location->>'type' <> 'in_person' and coalesce(btrim(v_location->>'meeting_url'), '') = '' then
            raise exception 'Online locations require a meeting link.' using hint = 'EVENT_SETTINGS_CONFLICT';
          end if;
          if v_config->>'audience' = 'going' and coalesce(btrim(v_location->>'public_summary'), '') = '' then
            raise exception 'Add a public location summary for each restricted location.' using hint = 'EVENT_SETTINGS_CONFLICT';
          end if;
          if (v_location->>'type' <> 'online' and coalesce(v_location->>'map_url', '') <> '' and (v_location->>'map_url') !~* '^https?://[^/[:space:]]+')
            or (v_location->>'type' <> 'in_person' and coalesce(v_location->>'meeting_url', '') <> '' and (v_location->>'meeting_url') !~* '^https?://[^/[:space:]]+') then
            raise exception 'Enter valid HTTP or HTTPS location links.' using hint = 'EVENT_SETTINGS_CONFLICT';
          end if;
        end loop;
        for v_item in select value from jsonb_array_elements(v_day->'items') loop
          v_key := (v_item->>'key')::uuid;
          if v_key is null or v_key = any(v_all_keys) or coalesce(btrim(v_item->>'label'), '') = '' or jsonb_typeof(v_item->'check_in') is distinct from 'boolean' then
            raise exception 'Every agenda item needs its own identity, label and check-in setting.' using hint = 'EVENT_SETTINGS_CONFLICT';
          end if;
          v_all_keys := array_append(v_all_keys, v_key);
          v_item_ids := array_append(v_item_ids, v_key);
          if exists(
            select 1 from public.event_agenda_items i join public.event_agenda_days d on d.id = i.event_agenda_day_id
            where i.id = v_key and (d.event_id is distinct from p_event_id or d.id <> (v_day->>'key')::uuid)
          ) then
            raise exception 'Agenda item belongs to another day or event.';
          end if;
          v_item_start := public.agenda_pacific_instant(v_day->>'date', v_item->>'start');
          v_item_end := public.agenda_pacific_instant(v_item->>'end_date', v_item->>'end');
          if v_item_end <= v_item_start then
            raise exception 'Item end must be after its start.' using hint = 'EVENT_SETTINGS_CONFLICT';
          end if;
          v_day_start := least(v_day_start, v_item_start);
          v_day_end := greatest(v_day_end, v_item_end);
          v_item := v_item || jsonb_build_object('start_time', v_item_start, 'end_time', v_item_end);
          if (v_item->>'check_in')::boolean then
            v_sessions := v_sessions || jsonb_build_array(jsonb_build_object('id', v_item->'session_id', 'name', v_item->>'label', 'start_time', v_item_start, 'end_time', v_item_end));
          end if;
          v_items := v_items || jsonb_build_array(v_item);
        end loop;
        v_first_start := least(v_first_start, v_day_start);
        v_last_end := greatest(v_last_end, v_day_end);
        v_days := v_days || jsonb_build_array(v_day || jsonb_build_object('items', v_items, 'start_time', v_day_start, 'end_time', v_day_end));
      end loop;
      v_config := v_config || jsonb_build_object('dates', v_days, 'location', v_days->0->'location');
      v_location := v_config->'location';
      p_event := p_event || jsonb_build_object('starts_at', v_first_start, 'ends_at', v_last_end,
        'location_type', v_location->>'type',
        'location_building', case when v_config->>'audience' = 'going' then v_location->>'public_summary' when v_location->>'type' = 'online' then 'Online' else v_location->>'building' end,
        'location_room', case when v_config->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'room', '') end,
        'location_address', case when v_config->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'address', '') end,
        'location_address_url', case when v_config->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'map_url', '') end);
      p_check_in_sessions := v_sessions;
      if p_event_id is not null then
        -- Write before the events trigger checks the derived envelope.
        insert into public.event_date_location_settings values(p_event_id, v_config, coalesce(v_existing.revision, 0) + 1)
        on conflict(event_id) do update set document = excluded.document, revision = excluded.revision;
      end if;
    elsif v_config is not null and v_config <> 'null'::jsonb then
      -- Version 1 settings: a list of dates, each one check-in session.
      if coalesce((p_event->>'_date_revision')::integer, 0) <> coalesce(v_existing.revision, 0) then
        raise exception 'Dates or locations changed in another tab. Reload before saving.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      if coalesce(v_config->>'audience', '') not in ('everyone', 'going') or coalesce(jsonb_typeof(v_config->'dates'), '') <> 'array'
        or jsonb_array_length(v_config->'dates') not between 1 and 100 then
        raise exception 'Add valid event dates and location settings.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      for v_location in select v_config->'location' union all
        select value->'location' from jsonb_array_elements(v_config->'dates') where value->'location' <> 'null'::jsonb
      loop
        if coalesce(v_location->>'type', '') not in ('in_person', 'online', 'hybrid') then
          raise exception 'Choose a location type.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
        if v_location->>'type' <> 'online' and (coalesce(btrim(v_location->>'building'), '') = '' or coalesce(btrim(v_location->>'address'), '') = '') then
          raise exception 'In-person locations require a building and street address.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
        if v_location->>'type' <> 'in_person' and coalesce(btrim(v_location->>'meeting_url'), '') = '' then
          raise exception 'Online locations require a meeting link.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
        if v_config->>'audience' = 'going' and coalesce(btrim(v_location->>'public_summary'), '') = '' then
          raise exception 'Add a public location summary for each restricted location.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
        if (v_location->>'type' <> 'online' and coalesce(v_location->>'map_url', '') <> '' and (v_location->>'map_url') !~* '^https?://[^/[:space:]]+')
          or (v_location->>'type' <> 'in_person' and coalesce(v_location->>'meeting_url', '') <> '' and (v_location->>'meeting_url') !~* '^https?://[^/[:space:]]+') then
          raise exception 'Enter a valid HTTP or HTTPS location link.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
      end loop;
      for v_item in select value from jsonb_array_elements(v_config->'dates') loop
        v_start := (v_item->>'start_time')::timestamptz;
        v_end := (v_item->>'end_time')::timestamptz;
        if v_start is null or v_end is null or v_start >= v_end then
          raise exception 'Every event date requires an end after its start.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
        v_sessions := v_sessions || jsonb_build_array(jsonb_build_object('id', v_item->'session_id', 'name', coalesce(nullif(v_item->>'label', ''), v_item->>'date'), 'start_time', v_start, 'end_time', v_end));
      end loop;
      if p_event_id is not null then
        if exists(
          select 1 from public.check_in_sessions session
          where event_id = p_event_id and start_time <= now()
            and not exists(select 1 from jsonb_array_elements(v_sessions) item where (item->>'id')::uuid = session.id)
        ) then
          raise exception 'A started event date cannot be removed.' using hint = 'EVENT_SETTINGS_CONFLICT';
        end if;
        -- Write before the events trigger checks the derived envelope.
        insert into public.event_date_location_settings(event_id, document, revision)
        values(p_event_id, v_config, coalesce(v_existing.revision, 0) + 1)
        on conflict(event_id) do update set document = excluded.document, revision = excluded.revision;
      end if;
      select min((item->>'start_time')::timestamptz), max((item->>'end_time')::timestamptz)
      into v_start, v_end from jsonb_array_elements(v_sessions) item;
      v_location := v_config->'location';
      p_event := p_event || jsonb_build_object('starts_at', v_start, 'ends_at', v_end,
        'location_type', v_location->>'type',
        'location_building', case when v_config->>'audience' = 'going' then v_location->>'public_summary' when v_location->>'type' = 'online' then 'Online' else v_location->>'building' end,
        'location_room', case when v_config->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'room', '') end,
        'location_address', case when v_config->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'address', '') end,
        'location_address_url', case when v_config->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'map_url', '') end);
      p_check_in_sessions := v_sessions;
    elsif v_existing.event_id is not null then
      -- Old clients cannot overwrite protected settings or their derived windows.
      if (p_event ? 'location_building' or p_event ? 'location_room' or p_event ? 'location_address_url') or p_check_in_sessions is distinct from (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'start_time', start_time, 'end_time', end_time) order by start_time), '[]')
        from public.check_in_sessions where event_id = p_event_id
      ) then
        raise exception 'Reload the event form before editing dates or locations.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
    end if;

    -- 3. The event row. The payload's keys that name a writable events
    -- column, quoted. id and updated_at are the table's own; slug is set
    -- once, on create.
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

    v_saved_sessions := public.save_event_check_in_sessions(v_event_id, p_check_in_sessions);
    v_saved_questions := public.save_event_application_questions(v_event_id, p_application_questions);

    if jsonb_array_length(coalesce(p_mentors, '[]'::jsonb)) <> (
      select count(distinct mentor_id)
      from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb)) as mentor(mentor_id)
    ) then
      raise exception 'The same mentor cannot be selected more than once.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb)) as selected(mentor_id)
      left join public.mentors mentor on mentor.id = selected.mentor_id::uuid
      where mentor.id is null
    ) then
      raise exception 'A selected mentor was not found.';
    end if;

    -- p_mentors is the event's Mentors section, made on first use and placed
    -- after any other. Sections it doesn't know, like Judges, are left alone.
    select section.id
    into v_mentor_section_id
    from public.event_people_sections section
    where section.event_id = v_event_id
      and lower(btrim(section.title)) = 'mentors';

    if v_mentor_section_id is null
      and jsonb_array_length(coalesce(p_mentors, '[]'::jsonb)) > 0 then
      insert into public.event_people_sections (event_id, title, sort_order)
      select v_event_id, 'Mentors', coalesce(max(section.sort_order) + 1, 0)
      from public.event_people_sections section
      where section.event_id = v_event_id
      returning id into v_mentor_section_id;
    end if;

    insert into public.event_mentors (event_id, section_id, mentor_id, sort_order)
    select v_event_id, v_mentor_section_id, selected.mentor_id::uuid, selected.ordinality - 1
    from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb))
      with ordinality as selected(mentor_id, ordinality)
    on conflict (section_id, mentor_id)
    do update set sort_order = excluded.sort_order;

    delete from public.event_mentors event_mentor
    where event_mentor.section_id = v_mentor_section_id
      and not exists (
        select 1
        from jsonb_array_elements_text(coalesce(p_mentors, '[]'::jsonb)) as selected(mentor_id)
        where selected.mentor_id::uuid = event_mentor.mentor_id
      );

    if jsonb_array_length(coalesce(p_sponsors, '[]'::jsonb)) <> (
      select count(distinct sponsor_id)
      from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb)) as sponsor(sponsor_id)
    ) then
      raise exception 'The same sponsor cannot be selected more than once.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb)) as selected(sponsor_id)
      left join public.sponsors sponsor on sponsor.id = selected.sponsor_id::uuid
      where sponsor.id is null
    ) then
      raise exception 'A selected sponsor was not found.';
    end if;

    insert into public.event_sponsors (event_id, sponsor_id, sort_order)
    select v_event_id, selected.sponsor_id::uuid, selected.ordinality - 1
    from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb))
      with ordinality as selected(sponsor_id, ordinality)
    on conflict (event_id, sponsor_id)
    do update set sort_order = excluded.sort_order;

    delete from public.event_sponsors event_sponsor
    where event_sponsor.event_id = v_event_id
      and not exists (
        select 1
        from jsonb_array_elements_text(coalesce(p_sponsors, '[]'::jsonb)) as selected(sponsor_id)
        where selected.sponsor_id::uuid = event_sponsor.sponsor_id
      );

    v_result := jsonb_build_object('id', v_event_id) || v_saved_sessions || v_saved_questions;

    -- 4. Dates and locations, now that the event and its check-in sessions
    -- exist: the agenda rows, and the settings with each session's id.
    if v_config->>'version' = '2' then
      v_days := '[]';
      for v_day in select value from jsonb_array_elements(v_config->'dates') loop
        insert into public.event_agenda_days(id, event_id, date, title, starts_at, ends_at)
        values((v_day->>'key')::uuid, v_event_id, (v_day->>'date')::date, v_day->>'label', (v_day->>'start_time')::timestamptz, (v_day->>'end_time')::timestamptz)
        on conflict(id) do update set date = excluded.date, title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at;
        v_items := '[]';
        for v_item in select value from jsonb_array_elements(v_day->'items') loop
          v_location := case when v_item->'location' is null or v_item->'location' = 'null'::jsonb then v_day->'location' else v_item->'location' end;
          insert into public.event_agenda_items(id, event_agenda_day_id, title, start_time, end_time, starts_at, ends_at, description, check_in, building, room)
          values((v_item->>'key')::uuid, (v_day->>'key')::uuid, v_item->>'label', (v_item->>'start')::time, (v_item->>'end')::time, (v_item->>'start_time')::timestamptz, (v_item->>'end_time')::timestamptz, coalesce(v_item->>'description', ''), (v_item->>'check_in')::boolean,
            case when v_config->>'audience' = 'going' then v_location->>'public_summary' when v_location->>'type' = 'online' then 'Online' else v_location->>'building' end,
            case when v_config->>'audience' = 'everyone' and v_location->>'type' <> 'online' then nullif(v_location->>'room', '') end)
          on conflict(id) do update set title = excluded.title, start_time = excluded.start_time, end_time = excluded.end_time, starts_at = excluded.starts_at, ends_at = excluded.ends_at, description = excluded.description, check_in = excluded.check_in, building = excluded.building, room = excluded.room;
          v_session_id := null;
          if (v_item->>'check_in')::boolean then
            v_session_id := (v_result->'check_in_session_ids'->>v_index)::uuid;
            v_index := v_index + 1;
            update public.check_in_sessions set agenda_item_id = (v_item->>'key')::uuid where id = v_session_id;
          end if;
          v_items := v_items || jsonb_build_array(v_item || jsonb_build_object('session_id', v_session_id));
        end loop;
        v_days := v_days || jsonb_build_array(v_day || jsonb_build_object('items', v_items));
      end loop;
      delete from public.event_agenda_items i using public.event_agenda_days d
      where i.event_agenda_day_id = d.id and d.event_id = v_event_id and not (i.id = any(v_item_ids));
      delete from public.event_agenda_days where event_id = v_event_id and not (id = any(v_day_ids));
      v_config := jsonb_set(v_config, '{dates}', v_days);
      insert into public.event_date_location_settings values(v_event_id, v_config, coalesce(v_existing.revision, 0) + 1)
      on conflict(event_id) do update set document = excluded.document, revision = excluded.revision;
      v_result := v_result || jsonb_build_object('date_location_revision', coalesce(v_existing.revision, 0) + 1);
    elsif v_config is not null and v_config <> 'null'::jsonb then
      for v_item in select value from jsonb_array_elements(v_config->'dates') loop
        v_days := v_days || jsonb_build_array(v_item || jsonb_build_object('session_id', v_result->'check_in_session_ids'->v_index));
        v_index := v_index + 1;
      end loop;
      v_config := jsonb_set(v_config, '{dates}', v_days);
      insert into public.event_date_location_settings(event_id, document, revision)
      values(v_event_id, v_config, coalesce(v_existing.revision, 0) + 1)
      on conflict(event_id) do update set document = excluded.document, revision = excluded.revision;
      v_result := v_result || jsonb_build_object('date_location_revision', coalesce(v_existing.revision, 0) + 1);
    end if;

    -- 5. Application timing, and the questions a published application
    -- event needs.
    v_timing := p_event->'_application_timing';
    if v_timing is not null then
      if jsonb_typeof(v_timing) <> 'object' then
        raise exception 'Invalid application timing settings.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      insert into public.event_application_settings(event_id, decisions_release_at, confirmation_deadline)
      values(v_event_id, (v_timing->>'decisions_release_at')::timestamptz, (v_timing->>'confirmation_deadline')::timestamptz)
      on conflict(event_id) do update set decisions_release_at = excluded.decisions_release_at, confirmation_deadline = excluded.confirmation_deadline;
    end if;
    select * into v_saved from public.events where id = v_event_id;
    if v_saved.requires_application and (v_saved.status = 'active' or v_saved.publish_at is not null) then
      if not exists(select 1 from public.event_application_questions where event_id = v_event_id) or exists(
        select 1 from public.event_application_questions q where q.event_id = v_event_id and (
          nullif(btrim(q.question), '') is null
          or (q.response_type in ('short_text', 'long_text') and q.max_char_limit is not null and q.max_char_limit <= 0)
          or (q.response_type in ('checkbox', 'multiple_choice', 'dropdown') and (coalesce(cardinality(q.response_options), 0) = 0 or exists(select 1 from unnest(q.response_options) option where nullif(btrim(option), '') is null)))
        )
      ) then
        raise exception 'Applications require at least one valid question before publication.' using hint = 'APPLICATION_QUESTIONS_CONFLICT';
      end if;
    end if;
  exception when check_violation then
    if sqlerrm like '%application_timing_order%' then
      raise exception 'Confirm by must be later than Release decisions on.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    raise;
  end;

  -- 6. People and resources (continued). All changes below participate in
  -- the caller's transaction; shared directory rows are never updated.
  if v_content is not null then
    delete from public.event_mentors where event_id = v_event_id;
    delete from public.event_sponsors where event_id = v_event_id;
    -- Retain section identities; park titles to allow renaming/swapping custom names.
    update public.event_people_sections set title = '__content_' || id::text where event_id = v_event_id;
    for v_section in select value from jsonb_array_elements(v_content->'sections') loop
      v_section_id := (v_section->>'key')::uuid;
      if exists(select 1 from public.event_people_sections where id = v_section_id and event_id <> v_event_id) then
        raise exception 'Section belongs to another event.' using hint = 'EVENT_CONTENT_INVALID';
      end if;
      insert into public.event_people_sections(id, event_id, title, sort_order) values(v_section_id, v_event_id, v_section->>'title', v_section_position)
      on conflict(id) do update set title = excluded.title, sort_order = excluded.sort_order;
      v_position := 0;
      for v_entry in select value from jsonb_array_elements(v_section->'items') loop
        v_entry_id := null;
        if v_section->>'kind' = 'Sponsors' then
          if v_entry->>'directory_id' is not null and not exists(select 1 from public.sponsors where id = (v_entry->>'key')::uuid and owner_event_id = v_event_id) then
            select * into v_sponsor from public.sponsors where id = (v_entry->>'directory_id')::uuid and owner_event_id is null;
            if not found then
              raise exception 'The selected shared sponsor was not found.' using hint = 'EVENT_CONTENT_INVALID';
            end if;
            if (v_sponsor.name, coalesce(v_sponsor.description, ''), coalesce(v_sponsor.website_url, ''), coalesce(v_sponsor.brand_logo_path, '')) is not distinct from
              (v_entry->>'name', v_entry->>'description', v_entry->>'url', v_entry->>'image_url') then
              v_entry_id := v_sponsor.id;
            end if;
          end if;
          if v_entry_id is null then
            v_entry_id := (v_entry->>'key')::uuid;
            if exists(select 1 from public.sponsors where id = v_entry_id and owner_event_id is distinct from v_event_id) then
              raise exception 'Entry belongs to another event.' using hint = 'EVENT_CONTENT_INVALID';
            end if;
            insert into public.sponsors(id, owner_event_id, name, description, website_url, brand_logo_path)
            values(v_entry_id, v_event_id, btrim(v_entry->>'name'), nullif(v_entry->>'description', ''), nullif(v_entry->>'url', ''), nullif(v_entry->>'image_url', ''))
            on conflict(id) do update set name = excluded.name, description = excluded.description, website_url = excluded.website_url, brand_logo_path = excluded.brand_logo_path;
          end if;
          insert into public.event_sponsors(event_id, sponsor_id, sort_order) values(v_event_id, v_entry_id, v_position);
        else
          if v_entry->>'directory_id' is not null and not exists(select 1 from public.mentors where id = (v_entry->>'key')::uuid and owner_event_id = v_event_id) then
            select * into v_mentor from public.mentors where id = (v_entry->>'directory_id')::uuid and owner_event_id is null;
            if not found then
              raise exception 'The selected shared person was not found.' using hint = 'EVENT_CONTENT_INVALID';
            end if;
            if (v_mentor.full_name, coalesce(v_mentor.position, ''), coalesce(v_mentor.description, ''), coalesce(v_mentor.linkedin_url, ''), coalesce(v_mentor.profile_image_path, '')) is not distinct from
              (v_entry->>'name', v_entry->>'position', v_entry->>'description', v_entry->>'url', v_entry->>'image_url') then
              v_entry_id := v_mentor.id;
            end if;
          end if;
          if v_entry_id is null then
            v_entry_id := (v_entry->>'key')::uuid;
            if exists(select 1 from public.mentors where id = v_entry_id and owner_event_id is distinct from v_event_id) then
              raise exception 'Entry belongs to another event.' using hint = 'EVENT_CONTENT_INVALID';
            end if;
            insert into public.mentors(id, owner_event_id, full_name, position, description, linkedin_url, profile_image_path)
            values(v_entry_id, v_event_id, btrim(v_entry->>'name'), nullif(v_entry->>'position', ''), nullif(v_entry->>'description', ''), nullif(v_entry->>'url', ''), nullif(v_entry->>'image_url', ''))
            on conflict(id) do update set full_name = excluded.full_name, position = excluded.position, description = excluded.description, linkedin_url = excluded.linkedin_url, profile_image_path = excluded.profile_image_path;
          end if;
          insert into public.event_mentors(event_id, section_id, mentor_id, sort_order) values(v_event_id, v_section_id, v_entry_id, v_position);
        end if;
        v_position := v_position + 1;
      end loop;
      v_section_position := v_section_position + 1;
    end loop;
    delete from public.event_people_sections
    where event_id = v_event_id and id not in (select (value->>'key')::uuid from jsonb_array_elements(v_content->'sections'));
    for v_link in select value from jsonb_array_elements(v_content->'links') loop
      if exists(select 1 from public.event_links where id = (v_link->>'id')::uuid and event_id <> v_event_id) then
        raise exception 'Resource belongs to another event.' using hint = 'EVENT_CONTENT_INVALID';
      end if;
    end loop;
    -- Links re-insert under their own ids; carry each one's agenda item over.
    select coalesce(jsonb_object_agg(id, agenda_item_id), '{}') into v_item_links
    from public.event_links where event_id = v_event_id and agenda_item_id is not null;
    delete from public.event_links where event_id = v_event_id;
    insert into public.event_links(id, event_id, type, label, url, visibility, sort_order, agenda_item_id)
    select (value->>'id')::uuid, v_event_id, (value->>'type')::public.event_link_type, nullif(btrim(value->>'label'), ''), value->>'url', (value->>'visibility')::public.event_link_visibility, ordinality - 1, (v_item_links->>(value->>'id'))::uuid
    from jsonb_array_elements(v_content->'links') with ordinality where value->>'type' <> 'volunteer_schedule';
    v_content := v_content || jsonb_build_object('revision', coalesce(v_content_revision, 0) + 1);
    insert into public.event_content_settings(event_id, document, revision) values(v_event_id, v_content, coalesce(v_content_revision, 0) + 1)
    on conflict(event_id) do update set document = excluded.document, revision = excluded.revision;
    v_result := v_result || jsonb_build_object('content', v_content);
  end if;

  return v_result;
end;
$function$;

create or replace function public.save_admin_event_builder(
  p_event_id uuid,
  p_draft_id uuid,
  p_draft_revision integer,
  p_event jsonb,
  p_slug text,
  p_expected_image_url text,
  p_expected_header_image_url text,
  p_check_in_sessions jsonb,
  p_application_questions jsonb,
  p_mentors jsonb,
  p_sponsors jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_event public.events;
  v_event_id uuid := p_event_id;
  v_operation_id uuid;
  v_receipt public.admin_event_mutations;
  v_request jsonb;
  v_expected jsonb;
  v_base text;
  v_candidate text;
  v_suffix text;
  v_counter integer := 0;
  v_canonical text;
  v_saved public.events;
  v_result jsonb;
begin
  -- An agenda (version 2 dates) sets the event's envelope from its items.
  if p_event #>> '{_date_location,version}' = '2' then
    select min(public.agenda_pacific_instant(d->>'date', i->>'start')),
      max(public.agenda_pacific_instant(i->>'end_date', i->>'end'))
    into v_first_start, v_last_end
    from jsonb_array_elements(p_event #> '{_date_location,dates}') d
    cross join lateral jsonb_array_elements(d->'items') i;
    p_event := p_event || jsonb_build_object('starts_at', v_first_start, 'ends_at', v_last_end);
  end if;

  -- The scheduler takes this advisory lock before event rows. Take it before
  -- any row lock here as well, replays included.
  perform pg_catalog.pg_advisory_xact_lock(20270101, 13);

  if not exists (select 1 from public.admin_event_mutations where id = (p_event->>'_operation_id')::uuid)
     and exists (
       select 1 from public.events
       where canceled_at is not null
         and (id = p_event_id or id = p_draft_id or p_draft_id = any(legacy_draft_ids))
     ) then
    raise exception 'This event is canceled. Only links and resources can be updated.' using hint = 'EVENT_HISTORY_LOCKED';
  end if;

  -- The operation id keys the durable receipt that answers a retried request
  -- whose response was lost. A draft without one gets a key derived from its
  -- revision.
  v_operation_id := (p_event->>'_operation_id')::uuid;
  if v_operation_id is not null then
    select * into v_receipt from public.admin_event_mutations where id = v_operation_id;
  end if;
  if p_draft_id is not null then
    v_operation_id := coalesce((p_event->>'_operation_id')::uuid, md5('legacy-event-builder:' || p_draft_id || ':' || p_draft_revision)::uuid);
    p_event := p_event || jsonb_build_object('_operation_id', v_operation_id);
    select * into v_receipt from public.admin_event_mutations where id = v_operation_id;
    select * into v_event from public.events
    where id = coalesce(p_event_id, p_draft_id) or p_draft_id = any(legacy_draft_ids) for update;
    if not found then raise exception 'Draft not found.'; end if;
    v_event_id := v_event.id;
    if v_event.working_document is not null and v_event.working_revision <> p_draft_revision and v_receipt.id is null then
      raise exception 'DRAFT_CONFLICT';
    end if;
    if p_event_id is null then
      if v_receipt.id is not null then
        p_event := p_event || jsonb_build_object('_expected_revision', v_receipt.request #> '{event,_expected_revision}');
        p_expected_image_url := v_receipt.request->>'image';
        p_expected_header_image_url := v_receipt.request->>'header';
      elsif v_event.working_document is not null then
        p_event := p_event || jsonb_build_object('_expected_revision', v_event.revision);
        p_expected_image_url := v_event.image_url;
        p_expected_header_image_url := v_event.header_image_url;
      end if;
    end if;
  end if;
  if v_event_id is not null then
    select * into v_event from public.events where id = v_event_id for update;
  end if;

  -- An unscheduled draft's working document may hold settings this request
  -- leaves out; refuse rather than publish without them.
  if v_receipt.id is null and v_event.working_document is not null then
    if v_event.working_document #> '{formState,content}' is not null and v_event.working_document #> '{formState,content}' <> 'null'::jsonb
      and (p_event->'_content' is null or p_event->'_content' = 'null'::jsonb) then
      raise exception 'Reload saved people and resources before publishing.' using hint = 'EVENT_CONTENT_INVALID';
    end if;
    if v_event.working_document #> '{formState,date_location}' is not null and v_event.working_document #> '{formState,date_location}' <> 'null'::jsonb
      and (p_event->'_date_location' is null or p_event->'_date_location' = 'null'::jsonb) then
      raise exception 'Reload saved dates and locations before publishing.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    if (nullif(v_event.working_document #>> '{formState,decisions_release_at}', '') is not null or nullif(v_event.working_document #>> '{formState,confirmation_deadline}', '') is not null)
      and (p_event->'_application_timing' is null or p_event->'_application_timing' = 'null'::jsonb) then
      raise exception 'Reload saved application timing before publishing.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
  end if;

  -- An unedited page URL follows the name until the event is first published.
  if p_event->>'configured_slug_edited' = 'false' then
    if v_receipt.id is not null and v_receipt.request #> '{event,configured_slug}' is not null then
      p_event := jsonb_set(p_event, '{configured_slug}', v_receipt.request #> '{event,configured_slug}');
    elsif v_event.first_published_at is null then
      v_base := rtrim(left(btrim(regexp_replace(lower(btrim(coalesce(p_event->>'name', v_event.name, ''))), '[^a-z0-9]+', '-', 'g'), '-'), 100), '-');
      if v_base = '' then v_base := coalesce(v_event.slug, 'event'); end if;
      if v_base in ('new', 'create', 'create-new', 'admin', 'api', 'auth', 'portal', 'events', 'drafts', 'dev', 'settings') then
        v_base := v_base || '-event';
      end if;
      v_candidate := v_base;
      v_suffix := substring(v_event.slug from '-[0-9]+$');
      if v_suffix is not null and v_event.slug = rtrim(left(v_base, 100 - length(v_suffix)), '-') || v_suffix then
        v_candidate := v_event.slug;
      end if;
      loop
        exit when not exists(select 1 from public.event_url_claims where slug = v_candidate and event_id is distinct from v_event_id)
          and not exists(select 1 from public.events where slug = v_candidate and id is distinct from v_event_id);
        v_counter := v_counter + 1;
        v_suffix := '-' || v_counter;
        v_candidate := rtrim(left(v_base, 100 - length(v_suffix)), '-') || v_suffix;
      end loop;
      p_event := jsonb_set(p_event, '{configured_slug}', to_jsonb(v_candidate));
      if v_event_id is null then p_slug := v_candidate; end if;
    end if;
  end if;

  -- Saving through the builder ends the event's draft working document.
  p_event := p_event || jsonb_build_object('working_document', null);

  -- The receipt's request, built as the save functions before this one built
  -- it, so a retry they recorded still matches.
  v_request := jsonb_build_object('event_id', v_event_id, 'draft_id', null::uuid, 'draft_revision', 0,
    'event', p_event, 'image', p_expected_image_url, 'header', p_expected_header_image_url,
    'sessions', p_check_in_sessions, 'questions', p_application_questions, 'mentors', p_mentors, 'sponsors', p_sponsors);

  if v_receipt.id is not null then
    if v_receipt.request <> v_request then
      raise exception 'This retry differs from the original request. Review the saved event before saving again.' using hint = 'EVENT_REVISION_CONFLICT';
    end if;
    v_result := v_receipt.result;
  else
    if v_event_id is not null then
      select * into v_event from public.events where id = v_event_id for update;
      if not found then raise exception 'This event no longer exists.' using hint = 'EVENT_REVISION_CONFLICT'; end if;
      if p_event ? '_expected_revision' and v_event.revision <> (p_event->>'_expected_revision')::integer then
        raise exception 'This event changed in another tab. Your edits are still here. Reload the saved event before updating.' using hint = 'EVENT_REVISION_CONFLICT';
      end if;
      if public.event_has_ended(v_event) then
        raise exception 'This event has ended. Only links and resources can be updated.' using hint = 'EVENT_HISTORY_LOCKED';
      end if;
    end if;
    p_event := p_event - '_operation_id' - '_expected_revision';

    -- Publication: the status and schedule this form loaded with must still
    -- hold, and a published or scheduled event needs its required fields.
    v_expected := p_event->'_expected_publication';
    if v_event_id is not null and v_expected is not null and v_expected <> 'null'::jsonb
      and (v_event.status::text, v_event.publish_at) is distinct from (v_expected->>'status', (v_expected->>'publish_at')::timestamptz) then
      raise exception 'The publication status or schedule changed elsewhere. Reload before saving; your edits are still here.' using hint = 'EVENT_PUBLICATION_CONFLICT';
    end if;
    if p_event->>'status' = 'active' or nullif(p_event->>'publish_at', '') is not null then
      if btrim(coalesce(p_event->>'name', '')) = '' then raise exception 'Event name is required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if btrim(coalesce(p_event->>'short_description', '')) = '' then raise exception 'Short description is required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if coalesce(p_event->>'configured_marketing_mode', 'hosted') <> 'disabled' and btrim(coalesce(p_event->>'description', '')) = '' then raise exception 'Description is required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if length(p_event->>'short_description') > 50 or length(p_event->>'description') > 3000 then raise exception 'Overview exceeds its character limit.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if p_event->>'starts_at' is null or p_event->>'ends_at' is null then raise exception 'Event start and end dates and times are required.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if (p_event->>'starts_at')::timestamptz >= (p_event->>'ends_at')::timestamptz then raise exception 'Event end time must be after the start time.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if p_event->>'max_capacity' is null or (p_event->>'max_capacity')::numeric < 0 or (p_event->>'max_capacity')::numeric <> trunc((p_event->>'max_capacity')::numeric) then raise exception 'Capacity must be a nonnegative whole number.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if (p_event->>'requires_application')::boolean and jsonb_array_length(coalesce(p_application_questions, '[]')) = 0 then raise exception 'Applications require at least one valid question before publication.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
      if nullif(p_event->>'publish_at', '') is not null and nullif(p_event->>'registration_closes_at', '') is not null and (p_event->>'publish_at')::timestamptz >= (p_event->>'registration_closes_at')::timestamptz then raise exception 'Publish time must be before registration closes.' using hint = 'EVENT_PUBLICATION_INVALID'; end if;
    end if;
    p_event := p_event - '_expected_publication';

    -- A header the form didn't change is left alone, so a stale tab cannot
    -- revert a replacement made elsewhere; changing it requires the row to
    -- still hold the header this form loaded with.
    if v_event_id is not null then
      if p_event ? 'header_image_url' and (p_event->>'header_image_url') is distinct from p_expected_header_image_url then
        if v_event.header_image_url is distinct from p_expected_header_image_url then raise exception 'EVENT_IMAGE_CONFLICT'; end if;
      elsif v_event.header_image_url is distinct from p_expected_header_image_url then
        p_event := p_event - 'header_image_url' - 'header_colour';
      end if;
    end if;

    v_result := public.save_admin_event_atomically(v_event_id, p_event, p_slug, p_expected_image_url,
      p_check_in_sessions, p_application_questions, p_mentors, p_sponsors);

    -- Report the saved lifecycle and revision.
    select * into v_saved from public.events where id = (v_result->>'id')::uuid;
    v_result := v_result || jsonb_build_object('publication', jsonb_build_object(
      'id', v_saved.id, 'name', v_saved.name, 'status', v_saved.status,
      'publish_at', v_saved.publish_at, 'registration_opens_at', v_saved.registration_opens_at,
      'registration_closes_at', v_saved.registration_closes_at));
    v_result := v_result || jsonb_build_object('revision', v_saved.revision);
    if v_operation_id is not null then
      insert into public.admin_event_mutations(id, request, result) values(v_operation_id, v_request, v_result);
    end if;
  end if;

  update public.admin_event_drafts set materialized = true, updated_at = now() where event_id = (v_result->>'id')::uuid;
  select slug into v_canonical from public.events where id = (v_result->>'id')::uuid;
  v_canonical := coalesce(v_canonical, v_result->>'page_slug', v_receipt.result->>'page_slug');
  v_result := v_result || jsonb_build_object('page_slug', v_canonical);
  if v_operation_id is not null then
    update public.admin_event_mutations set result = v_result where id = v_operation_id;
  end if;
  return v_result;
end;
$function$;

create or replace function public.delete_event_atomically(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_commitments record;
begin
  perform 1 from public.events where id = target_event_id for update;
  -- Hold the purchases so none turns live between the check and the delete.
  perform 1 from public.purchases where event_id = target_event_id for update;

  select * into v_commitments from public.event_member_commitments(target_event_id);
  if v_commitments.tickets > 0 or v_commitments.offers > 0 or v_commitments.pending_purchases > 0 then
    raise exception 'Unable to delete the event because members are registered, hold offers or have payments in progress.'
      using hint = 'EVENT_DELETE_PROTECTED';
  end if;

  if public.event_has_live_purchases(target_event_id) then
    raise exception 'Unable to delete the event because it has purchases that are not failed, canceled or refunded.'
      using hint = 'EVENT_DELETE_PROTECTED';
  end if;

  delete from public.purchases p
  where p.event_id = target_event_id and not public.purchase_is_live(p.id);

  delete from public.events where id = target_event_id;
end;
$function$;

-- The wrapped layers, now inlined above, and a draft save nothing calls.
drop function if exists public.save_admin_event_builder_before_agenda_timing(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_builder_before_cancellation(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_builder_before_unified_drafts(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_builder_before_safe_mutations(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_builder_before_publication(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_before_content(uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_before_application_settings(uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_before_agenda(uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_admin_event_before_date_locations(uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.delete_event_before_safe_mutations(uuid);
drop function if exists public.save_admin_event_draft_before_url_activation(uuid, uuid, jsonb, integer);

comment on table public.event_private_details is
  'Retired: nothing reads or writes it since 20261124153406. Kept only until a follow-up migration drops it.';
