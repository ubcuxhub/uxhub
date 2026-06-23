-- Add slug column to events table for public URL-friendly event detail pages.
-- Slugs are auto-generated from the event name on insert if not supplied.

alter table events add column if not exists slug text;

-- Create a unique index on slug (allows null but unique when set)
create unique index if not exists idx_events_slug on events (slug) where slug is not null;

-- Backfill existing events with a slug derived from their name
update events
set slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
where slug is null;

-- Create a function to auto-generate slugs on insert
create or replace function generate_event_slug()
returns trigger as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(
      regexp_replace(
        regexp_replace(trim(new.name), '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      )
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_event_slug
  before insert on events
  for each row
  execute function generate_event_slug();
