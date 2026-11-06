-- People sections on an event page (Figma "Add a section"): Judges, Mentors,
-- Speakers, Panelists, or a custom title. Each section is one card; the
-- people in it are mentors rows linked through event_mentors, so one person
-- can sit in several sections of the same event (a mentor who also judges).
-- Sponsors keep their own tables.

create table public.event_people_sections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The target of event_mentors' (event_id, section_id) key, which keeps a
  -- link and its section on the same event.
  unique (event_id, id)
);

-- One section per title per event, however it is capitalised or spaced.
create unique index event_people_sections_event_title_key
  on public.event_people_sections (event_id, lower(btrim(title)));

create trigger update_event_people_sections_updated_at
  before update on public.event_people_sections
  for each row execute function public.update_updated_at_column();

-- ── event_mentors: one row per person per section ───────────────────────

alter table public.event_mentors add column section_id uuid;

-- Every existing link becomes a Mentors section, the only kind there was.
insert into public.event_people_sections (event_id, title, sort_order)
select distinct event_id, 'Mentors', 0
from public.event_mentors;

update public.event_mentors event_mentor
set section_id = section.id
from public.event_people_sections section
where section.event_id = event_mentor.event_id
  and section.title = 'Mentors';

alter table public.event_mentors
  alter column section_id set not null,
  add constraint event_mentors_section_id_fkey
    foreign key (event_id, section_id)
    references public.event_people_sections (event_id, id)
    on delete cascade,
  drop constraint event_mentors_pkey,
  add primary key (section_id, mentor_id);

-- The old key indexed event_id; reads still filter by it.
create index event_mentors_event_id_idx
  on public.event_mentors (event_id, sort_order);

-- ── RLS ──────────────────────────────────────────────────────────────────
--
-- Reads follow the parent event, as for event_mentors. There are no write
-- policies: writes go through the service-role client with the rest of the
-- admin event save.

alter table public.event_people_sections enable row level security;

create policy "public can view people sections for active events"
on public.event_people_sections
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_people_sections.event_id
      and public.event_is_public(event.status, event.publish_at)
  )
);

create policy "admins can view all people sections"
on public.event_people_sections
for select
to authenticated
using (public.is_admin());

-- Supabase grants every privilege on new public tables by default; take the
-- write privileges back so the browser roles are read-only, not just filtered.
revoke all on public.event_people_sections from anon, authenticated;
grant select on public.event_people_sections to anon, authenticated;
grant all on public.event_people_sections to service_role;

-- ── save_admin_event_atomically ──────────────────────────────────────────
--
-- The deployed builder sends p_mentors as before; they now land in the
-- event's Mentors section. Its arguments and grants are unchanged.

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
