-- Retain incomplete inactive type fields; only the selected location type is used.
create or replace function public.save_admin_event_atomically(
  p_event_id uuid, p_event jsonb, p_slug text, p_expected_image_url text,
  p_check_in_sessions jsonb, p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_config jsonb := p_event->'_date_location'; v_existing public.event_date_location_settings;
  v_item jsonb; v_loc jsonb; v_dates jsonb := '[]'; v_sessions jsonb := '[]';
  v_start timestamptz; v_end timestamptz; v_result jsonb; v_event_id uuid;
  v_index integer := 0; v_location jsonb; v_current public.events;
begin
  if p_event_id is not null then
    select * into v_current from public.events where id = p_event_id for update;
    select * into v_existing from public.event_date_location_settings where event_id = p_event_id;
  end if;
  if v_config is not null and v_config <> 'null'::jsonb then
    if coalesce((p_event->>'_date_revision')::integer, 0) <> coalesce(v_existing.revision, 0) then
      raise exception 'Dates or locations changed in another tab. Reload before saving.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    if coalesce(v_config->>'audience', '') not in ('everyone', 'going') or coalesce(jsonb_typeof(v_config->'dates'), '') <> 'array'
      or jsonb_array_length(v_config->'dates') not between 1 and 100 then
      raise exception 'Add valid event dates and location settings.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
    for v_loc in select v_config->'location' union all
      select value->'location' from jsonb_array_elements(v_config->'dates') where value->'location' <> 'null'::jsonb
    loop
      if coalesce(v_loc->>'type', '') not in ('in_person', 'online', 'hybrid') then
        raise exception 'Choose a location type.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      if v_loc->>'type' <> 'online' and (coalesce(btrim(v_loc->>'building'), '') = '' or coalesce(btrim(v_loc->>'address'), '') = '') then
        raise exception 'In-person locations require a building and street address.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      if v_loc->>'type' <> 'in_person' and coalesce(btrim(v_loc->>'meeting_url'), '') = '' then
        raise exception 'Online locations require a meeting link.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      if v_config->>'audience' = 'going' and coalesce(btrim(v_loc->>'public_summary'), '') = '' then
        raise exception 'Add a public location summary for each restricted location.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      if (v_loc->>'type' <> 'online' and coalesce(v_loc->>'map_url', '') <> '' and (v_loc->>'map_url') !~* '^https?://[^/[:space:]]+')
        or (v_loc->>'type' <> 'in_person' and coalesce(v_loc->>'meeting_url', '') <> '' and (v_loc->>'meeting_url') !~* '^https?://[^/[:space:]]+') then
        raise exception 'Enter a valid HTTP or HTTPS location link.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_config->'dates') loop
      v_start := (v_item->>'start_time')::timestamptz; v_end := (v_item->>'end_time')::timestamptz;
      if v_start is null or v_end is null or v_start >= v_end then
        raise exception 'Every event date requires an end after its start.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      v_sessions := v_sessions || jsonb_build_array(jsonb_build_object('id', v_item->'session_id', 'name', coalesce(nullif(v_item->>'label', ''), v_item->>'date'), 'start_time', v_start, 'end_time', v_end));
    end loop;
    if p_event_id is not null then
      if exists(select 1 from public.check_in_sessions session where event_id = p_event_id and start_time <= now()
        and not exists(select 1 from jsonb_array_elements(v_sessions) item where (item->>'id')::uuid = session.id)) then
        raise exception 'A started event date cannot be removed.' using hint = 'EVENT_SETTINGS_CONFLICT';
      end if;
      -- Write before the events trigger checks the derived envelope. Any failure
      -- in the underlying save rolls this back with the rest of the statement.
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
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'start_time', start_time, 'end_time', end_time) order by start_time), '[]') from public.check_in_sessions where event_id = p_event_id
    ) then
      raise exception 'Reload the event form before editing dates or locations.' using hint = 'EVENT_SETTINGS_CONFLICT';
    end if;
  end if;
  v_result := public.save_admin_event_before_date_locations(p_event_id, p_event, p_slug, p_expected_image_url, p_check_in_sessions, p_application_questions, p_mentors, p_sponsors);
  v_event_id := (v_result->>'id')::uuid;
  if v_config is not null and v_config <> 'null'::jsonb then
    for v_item in select value from jsonb_array_elements(v_config->'dates') loop
      v_dates := v_dates || jsonb_build_array(v_item || jsonb_build_object('session_id', v_result->'check_in_session_ids'->v_index));
      v_index := v_index + 1;
    end loop;
    v_config := jsonb_set(v_config, '{dates}', v_dates);
    insert into public.event_date_location_settings(event_id, document, revision)
    values(v_event_id, v_config, coalesce(v_existing.revision, 0) + 1)
    on conflict(event_id) do update set document = excluded.document, revision = excluded.revision;
    -- Preserve the existing Going/staff meeting boundary for current consumers.
    if v_location->>'type' <> 'in_person' then
      insert into public.event_private_details(event_id, meeting_url, meeting_id, meeting_passcode)
      values(v_event_id, v_location->>'meeting_url', nullif(v_location->>'meeting_id', ''), nullif(v_location->>'meeting_passcode', ''))
      on conflict(event_id) do update set meeting_url = excluded.meeting_url, meeting_id = excluded.meeting_id, meeting_passcode = excluded.meeting_passcode;
    else
      delete from public.event_private_details where event_id = v_event_id;
    end if;
    v_result := v_result || jsonb_build_object('date_location_revision', coalesce(v_existing.revision, 0) + 1);
  end if;
  return v_result;
end $$;
