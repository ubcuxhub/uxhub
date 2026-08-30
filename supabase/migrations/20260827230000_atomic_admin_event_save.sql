create or replace function public.save_admin_event_atomically(
  p_event_id uuid,
  p_event jsonb,
  p_slug text,
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
  v_mentor_id uuid;
  v_sponsor_id uuid;
  v_mentor_ids uuid[] := array[]::uuid[];
  v_sponsor_ids uuid[] := array[]::uuid[];
  v_item record;
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
      applications_enabled,
      regular_price,
      member_price,
      max_capacity,
      created_at,
      location_building,
      location_room,
      location_address_url,
      start_date,
      start_time,
      end_date,
      end_time,
      image_url,
      registration_start_time,
      registration_end_time,
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
      (p_event ->> 'applications_enabled')::boolean,
      (p_event ->> 'regular_price')::numeric,
      (p_event ->> 'member_price')::numeric,
      (p_event ->> 'max_capacity')::integer,
      (p_event ->> 'created_at')::timestamptz,
      p_event ->> 'location_building',
      p_event ->> 'location_room',
      p_event ->> 'location_address_url',
      (p_event ->> 'start_date')::date,
      (p_event ->> 'start_time')::time,
      (p_event ->> 'end_date')::date,
      (p_event ->> 'end_time')::time,
      p_event ->> 'image_url',
      (p_event ->> 'registration_start_time')::timestamptz,
      (p_event ->> 'registration_end_time')::timestamptz,
      p_slug
    )
    returning id into v_event_id;
  else
    update public.events
    set
      name = p_event ->> 'name',
      short_description = p_event ->> 'short_description',
      description = p_event ->> 'description',
      status = (p_event ->> 'status')::public.event_status,
      event_type = (p_event ->> 'event_type')::public.event_type,
      mentors_enabled = (p_event ->> 'mentors_enabled')::boolean,
      sponsors_enabled = (p_event ->> 'sponsors_enabled')::boolean,
      applications_enabled = (p_event ->> 'applications_enabled')::boolean,
      regular_price = (p_event ->> 'regular_price')::numeric,
      member_price = (p_event ->> 'member_price')::numeric,
      max_capacity = (p_event ->> 'max_capacity')::integer,
      created_at = (p_event ->> 'created_at')::timestamptz,
      location_building = p_event ->> 'location_building',
      location_room = p_event ->> 'location_room',
      location_address_url = p_event ->> 'location_address_url',
      start_date = (p_event ->> 'start_date')::date,
      start_time = (p_event ->> 'start_time')::time,
      end_date = (p_event ->> 'end_date')::date,
      end_time = (p_event ->> 'end_time')::time,
      image_url = p_event ->> 'image_url',
      registration_start_time =
        (p_event ->> 'registration_start_time')::timestamptz,
      registration_end_time =
        (p_event ->> 'registration_end_time')::timestamptz
    where id = p_event_id
    returning id into v_event_id;

    if v_event_id is null then
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

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_mentors, '[]'::jsonb)) as mentor
    where mentor ->> 'id' is not null
    group by mentor ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'The same mentor cannot be selected more than once.';
  end if;

  for v_item in
    select mentor, ordinality - 1 as sort_order
    from jsonb_array_elements(coalesce(p_mentors, '[]'::jsonb))
      with ordinality as entries(mentor, ordinality)
  loop
    if v_item.mentor ->> 'id' is null then
      insert into public.mentors (
        full_name,
        position,
        linkedin_url,
        description,
        profile_image_path
      )
      values (
        trim(v_item.mentor ->> 'full_name'),
        nullif(trim(v_item.mentor ->> 'position'), ''),
        nullif(trim(v_item.mentor ->> 'linkedin_url'), ''),
        nullif(trim(v_item.mentor ->> 'description'), ''),
        nullif(trim(v_item.mentor ->> 'profile_image_path'), '')
      )
      returning id into v_mentor_id;
    else
      update public.mentors
      set
        full_name = trim(v_item.mentor ->> 'full_name'),
        position = nullif(trim(v_item.mentor ->> 'position'), ''),
        linkedin_url = nullif(trim(v_item.mentor ->> 'linkedin_url'), ''),
        description = nullif(trim(v_item.mentor ->> 'description'), ''),
        profile_image_path =
          nullif(trim(v_item.mentor ->> 'profile_image_path'), '')
      where id = (v_item.mentor ->> 'id')::uuid
      returning id into v_mentor_id;

      if v_mentor_id is null then
        raise exception 'Mentor not found.';
      end if;
    end if;

    v_mentor_ids := array_append(v_mentor_ids, v_mentor_id);
    insert into public.event_mentors (event_id, mentor_id, sort_order)
    values (v_event_id, v_mentor_id, v_item.sort_order)
    on conflict (event_id, mentor_id)
    do update set sort_order = excluded.sort_order;
  end loop;

  delete from public.event_mentors
  where event_id = v_event_id
    and not (mentor_id = any(v_mentor_ids));

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_sponsors, '[]'::jsonb)) as sponsor
    where sponsor ->> 'id' is not null
    group by sponsor ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'The same sponsor cannot be selected more than once.';
  end if;

  for v_item in
    select sponsor, ordinality - 1 as sort_order
    from jsonb_array_elements(coalesce(p_sponsors, '[]'::jsonb))
      with ordinality as entries(sponsor, ordinality)
  loop
    if v_item.sponsor ->> 'id' is null then
      insert into public.sponsors (name, brand_logo_path)
      values (
        trim(v_item.sponsor ->> 'name'),
        nullif(trim(v_item.sponsor ->> 'brand_logo_path'), '')
      )
      returning id into v_sponsor_id;
    else
      update public.sponsors
      set
        name = trim(v_item.sponsor ->> 'name'),
        brand_logo_path =
          nullif(trim(v_item.sponsor ->> 'brand_logo_path'), '')
      where id = (v_item.sponsor ->> 'id')::uuid
      returning id into v_sponsor_id;

      if v_sponsor_id is null then
        raise exception 'Sponsor not found.';
      end if;
    end if;

    v_sponsor_ids := array_append(v_sponsor_ids, v_sponsor_id);
    insert into public.event_sponsors (event_id, sponsor_id, sort_order)
    values (v_event_id, v_sponsor_id, v_item.sort_order)
    on conflict (event_id, sponsor_id)
    do update set sort_order = excluded.sort_order;
  end loop;

  delete from public.event_sponsors
  where event_id = v_event_id
    and not (sponsor_id = any(v_sponsor_ids));

  return jsonb_build_object(
    'id',
    v_event_id,
    'mentors',
    coalesce(
      (
        select jsonb_agg(to_jsonb(mentor) order by event_mentor.sort_order)
        from public.event_mentors event_mentor
        join public.mentors mentor on mentor.id = event_mentor.mentor_id
        where event_mentor.event_id = v_event_id
      ),
      '[]'::jsonb
    ),
    'sponsors',
    coalesce(
      (
        select jsonb_agg(to_jsonb(sponsor) order by event_sponsor.sort_order)
        from public.event_sponsors event_sponsor
        join public.sponsors sponsor on sponsor.id = event_sponsor.sponsor_id
        where event_sponsor.event_id = v_event_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.save_admin_event_atomically(
  uuid,
  jsonb,
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
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
