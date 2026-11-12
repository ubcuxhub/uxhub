-- Links and resources on an event page (Figma "Builder → event page"), and
-- the online meeting details only people going can see.
--
-- Both are read with the viewer's own client: RLS decides what each viewer
-- gets, so a link or meeting detail someone may not see never reaches them,
-- not just their page. Writes go through the service-role client with the
-- rest of the admin event save.

-- ── event_links ─────────────────────────────────────────────────────────

-- Slack workspace and Other links are buttons in the page header; the
-- participant package sits under View ticket; the recap has its own card.
create type public.event_link_type as enum (
  'slack_workspace',
  'participant_package',
  'event_recap',
  'other'
);

create type public.event_link_visibility as enum (
  -- Anyone who can see the event.
  'everyone',
  -- Ticket holders.
  'going',
  -- Anyone who can see the event, once it has ended.
  'after_event'
);

create table public.event_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type public.event_link_type not null,
  -- The button text. The page has its own for every type but Other.
  label text check (label is null or btrim(label) <> ''),
  url text not null check (btrim(url) <> ''),
  visibility public.event_link_visibility not null default 'everyone',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_links_other_needs_label
    check (type <> 'other' or label is not null)
);

create index event_links_event_id_idx on public.event_links (event_id, sort_order);

create trigger update_event_links_updated_at
  before update on public.event_links
  for each row execute function public.update_updated_at_column();

-- ── event_private_details ───────────────────────────────────────────────

-- One row per event with an online meeting. Kept off events, which anyone
-- can read, so only people going see where to join.
create table public.event_private_details (
  event_id uuid primary key references public.events(id) on delete cascade,
  meeting_url text not null check (btrim(meeting_url) <> ''),
  -- Google Meet has no ID, and many Zoom links carry the passcode.
  meeting_id text,
  meeting_passcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_event_private_details_updated_at
  before update on public.event_private_details
  for each row execute function public.update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────

alter table public.event_links enable row level security;
alter table public.event_private_details enable row level security;

create policy "public can view everyone links for active events"
on public.event_links
for select
to anon, authenticated
using (
  visibility = 'everyone'
  and exists (
    select 1
    from public.events event
    where event.id = event_links.event_id
      and public.event_is_public(event.status, event.publish_at)
  )
);

create policy "public can view after-event links once the event ends"
on public.event_links
for select
to anon, authenticated
using (
  visibility = 'after_event'
  and exists (
    select 1
    from public.events event
    where event.id = event_links.event_id
      and public.event_is_public(event.status, event.publish_at)
      -- Ended, as on the timeline: at its end, or its start if it has none.
      and coalesce(event.ends_at, event.starts_at) <= now()
  )
);

create policy "ticket holders can view going links"
on public.event_links
for select
to authenticated
using (
  visibility = 'going'
  and exists (
    select 1
    from public.event_tickets ticket
    where ticket.event_id = event_links.event_id
      and ticket.user_id = public.current_user_info_id()
  )
);

create policy "admins can view all event links"
on public.event_links
for select
to authenticated
using (public.is_admin());

create policy "ticket holders can view private details"
on public.event_private_details
for select
to authenticated
using (
  exists (
    select 1
    from public.event_tickets ticket
    where ticket.event_id = event_private_details.event_id
      and ticket.user_id = public.current_user_info_id()
  )
);

create policy "admins can view all private details"
on public.event_private_details
for select
to authenticated
using (public.is_admin());

-- Supabase grants every privilege on new public tables by default; take the
-- write privileges back so the browser roles are read-only, not just filtered.
-- Visitors who aren't signed in hold no ticket, so they get no private details
-- at all.
revoke all on public.event_links from anon, authenticated;
revoke all on public.event_private_details from anon, authenticated;
grant select on public.event_links to anon, authenticated;
grant select on public.event_private_details to authenticated;
grant all on public.event_links to service_role;
grant all on public.event_private_details to service_role;
