
alter table events add column if not exists slug text;


create unique index if not exists idx_events_slug on events (slug) where slug is not null;


update events
set slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
where slug is null;


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
