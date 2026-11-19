-- Reconcile working documents with the newer saves by child ID. The older
-- builder migrations replaced this function with whole-list replacement,
-- losing submitted-answer and attendance protections and returned child IDs.
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
  v_mentor_section_id uuid;
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

  return jsonb_build_object('id', v_event_id) || v_sessions || v_questions;
end;
$$;

-- Keep the complete successful result so a retry after a lost response gives
-- the form the same child IDs and file-cleanup list as the original save.
alter table public.admin_event_drafts add column materialized_result jsonb;

create or replace function public.save_admin_event_builder(
  p_event_id uuid, p_draft_id uuid, p_draft_revision integer,
  p_event jsonb, p_slug text, p_expected_image_url text,
  p_expected_header_image_url text, p_check_in_sessions jsonb,
  p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare v_draft public.admin_event_drafts; v_event public.events; v_result jsonb;
begin
  if p_draft_id is not null then
    select * into v_draft from public.admin_event_drafts where id = p_draft_id for update;
    if not found then raise exception 'Draft not found.'; end if;
    if v_draft.materialized and p_event_id is null then
      return coalesce(v_draft.materialized_result, jsonb_build_object('id', v_draft.event_id));
    end if;
    if v_draft.revision <> p_draft_revision or v_draft.event_id is distinct from p_event_id then raise exception 'DRAFT_CONFLICT'; end if;
  end if;
  if p_event_id is not null then
    select * into v_event from public.events where id = p_event_id for update;
    if not found then raise exception 'Event not found.'; end if;
    if p_event ? 'header_image_url' and (p_event->>'header_image_url') is distinct from p_expected_header_image_url then
      if v_event.header_image_url is distinct from p_expected_header_image_url then raise exception 'EVENT_IMAGE_CONFLICT'; end if;
    elsif v_event.header_image_url is distinct from p_expected_header_image_url then
      p_event := p_event - 'header_image_url' - 'header_colour';
    end if;
  end if;
  v_result := public.save_admin_event_atomically(p_event_id, p_event, p_slug, p_expected_image_url, p_check_in_sessions, p_application_questions, p_mentors, p_sponsors);
  if p_draft_id is not null then
    update public.admin_event_drafts set event_id = (v_result->>'id')::uuid,
      materialized = true, materialized_result = v_result, updated_at = now() where id = p_draft_id;
  end if;
  return v_result;
end $$;
revoke all on function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;
