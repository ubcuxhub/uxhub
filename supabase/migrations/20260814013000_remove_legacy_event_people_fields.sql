alter table public.events
  drop column if exists mentors,
  drop column if exists sponsor_logos;
