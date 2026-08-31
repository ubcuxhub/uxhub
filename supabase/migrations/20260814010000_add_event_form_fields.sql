do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type public.event_type as enum ('regular', 'flagship');
  end if;
end $$;

alter table public.events
  add column if not exists short_description text,
  add column if not exists event_type public.event_type not null default 'regular',
  add column if not exists mentors_enabled boolean not null default false,
  add column if not exists sponsors_enabled boolean not null default false,
  add column if not exists applications_enabled boolean not null default false;

update public.events
set short_description = left(description, 180)
where short_description is null
  and description is not null;

update public.events
set mentors_enabled = jsonb_typeof(mentors) = 'array'
  and jsonb_array_length(mentors) > 0
where mentors is not null;

update public.events
set sponsors_enabled = coalesce(array_length(sponsor_logos, 1), 0) > 0
where sponsor_logos is not null;

update public.events event
set applications_enabled = exists (
  select 1
  from public.event_application_questions question
  where question.event_id = event.id
);
