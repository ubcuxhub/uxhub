-- Puts a mentor link inserted without a section in its event's Mentors
-- section, made on first use.
--
-- Code written before people sections inserts event_mentors rows without
-- section_id: an older checkout's seed (including `pnpm seed --target=prod`)
-- and its supabase/tests/rls.sql. Without this, section_id's not-null check
-- rejects them. The admin save and the current seed set section_id
-- themselves and are unaffected.

create function public.event_mentors_default_section()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.section_id is not null then
    return new;
  end if;

  select section.id
  into new.section_id
  from public.event_people_sections section
  where section.event_id = new.event_id
    and lower(btrim(section.title)) = 'mentors';

  if new.section_id is null then
    insert into public.event_people_sections (event_id, title, sort_order)
    select new.event_id, 'Mentors', coalesce(max(section.sort_order) + 1, 0)
    from public.event_people_sections section
    where section.event_id = new.event_id
    returning id into new.section_id;
  end if;

  return new;
end;
$$;

create trigger event_mentors_default_section
  before insert on public.event_mentors
  for each row execute function public.event_mentors_default_section();
