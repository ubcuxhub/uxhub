-- Event builder settings the member event page shows (Figma "Builder → event
-- page"), and the sponsor details its Sponsors card lists.
--
-- Every new column is nullable or has a default, so the code already deployed
-- keeps inserting events and sponsors unchanged. save_admin_event_atomically
-- writes only the columns its payload names, so today's saves leave these
-- alone until the builder sends them.

create type public.event_location_type as enum ('in_person', 'online', 'hybrid');

alter table public.events
  -- The banner at the top of the event page: an image or a colour, never both.
  add column header_image_url text,
  add column header_colour text,
  -- The ticket gradient and featured card (`src/lib/event-colour.ts`).
  add column event_colour text,
  add column is_featured boolean not null default false,
  -- An external event website (e.g. Devpost); the page links /events/[slug]
  -- when unset.
  add column marketing_url text,
  -- The street address shown under the building. location_address_url stays
  -- the map link.
  add column location_address text,
  add column location_type public.event_location_type not null default 'in_person',
  -- On by default, so events that already have an agenda keep showing it.
  add column agenda_enabled boolean not null default true,
  add constraint events_header_image_or_colour
    check (num_nonnulls(header_image_url, header_colour) <= 1),
  -- `normalizeHex` stores #RRGGBB.
  add constraint events_header_colour_hex
    check (header_colour ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint events_event_colour_hex
    check (event_colour ~ '^#[0-9A-Fa-f]{6}$');

alter table public.sponsors
  add column description text,
  add column website_url text;
