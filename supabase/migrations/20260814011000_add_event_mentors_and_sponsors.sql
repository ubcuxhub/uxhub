create table public.mentors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text,
  linkedin_url text,
  description text,
  profile_image_path text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_logo_path text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.event_mentors (
  event_id uuid not null references public.events(id) on delete cascade,
  mentor_id uuid not null references public.mentors(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (event_id, mentor_id)
);

create table public.event_sponsors (
  event_id uuid not null references public.events(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (event_id, sponsor_id)
);

create index idx_event_mentors_event_sort
  on public.event_mentors(event_id, sort_order);
create index idx_event_mentors_mentor
  on public.event_mentors(mentor_id);
create index idx_event_sponsors_event_sort
  on public.event_sponsors(event_id, sort_order);
create index idx_event_sponsors_sponsor
  on public.event_sponsors(sponsor_id);
create index idx_mentors_full_name
  on public.mentors using btree (lower(full_name));
create index idx_sponsors_name
  on public.sponsors using btree (lower(name));

create trigger update_mentors_updated_at
before update on public.mentors
for each row execute function public.update_updated_at_column();

create trigger update_sponsors_updated_at
before update on public.sponsors
for each row execute function public.update_updated_at_column();

with legacy_mentors as (
  select distinct on (
    mentor ->> 'name',
    coalesce(mentor ->> 'linkedin_url', '')
  )
    mentor ->> 'name' as full_name,
    nullif(
      concat_ws(
        ' at ',
        nullif(mentor ->> 'role', ''),
        nullif(mentor ->> 'company', '')
      ),
      ''
    ) as position,
    nullif(mentor ->> 'linkedin_url', '') as linkedin_url,
    nullif(mentor ->> 'bio', '') as description,
    nullif(mentor ->> 'image_url', '') as profile_image_path
  from public.events event
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(event.mentors) = 'array' then event.mentors
      else '[]'::jsonb
    end
  ) mentor
  where nullif(mentor ->> 'name', '') is not null
)
insert into public.mentors (
  full_name,
  position,
  linkedin_url,
  description,
  profile_image_path
)
select
  full_name,
  position,
  linkedin_url,
  description,
  profile_image_path
from legacy_mentors;

insert into public.event_mentors (event_id, mentor_id, sort_order)
select
  event.id,
  catalog.id,
  legacy.ordinality::integer - 1
from public.events event
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(event.mentors) = 'array' then event.mentors
    else '[]'::jsonb
  end
) with ordinality as legacy(mentor, ordinality)
join public.mentors catalog
  on catalog.full_name = legacy.mentor ->> 'name'
  and coalesce(catalog.linkedin_url, '') =
    coalesce(legacy.mentor ->> 'linkedin_url', '')
on conflict (event_id, mentor_id) do update
set sort_order = excluded.sort_order;

with legacy_sponsors as (
  select distinct legacy.logo
  from public.events event
  cross join lateral unnest(coalesce(event.sponsor_logos, '{}'::text[]))
    as legacy(logo)
  where nullif(legacy.logo, '') is not null
)
insert into public.sponsors (name, brand_logo_path)
select
  'Imported Sponsor',
  legacy_sponsors.logo
from legacy_sponsors;

insert into public.event_sponsors (event_id, sponsor_id, sort_order)
select
  event.id,
  catalog.id,
  legacy.ordinality::integer - 1
from public.events event
cross join lateral unnest(coalesce(event.sponsor_logos, '{}'::text[]))
  with ordinality as legacy(logo, ordinality)
join public.sponsors catalog
  on catalog.brand_logo_path = legacy.logo
on conflict (event_id, sponsor_id) do update
set sort_order = excluded.sort_order;

alter table public.mentors enable row level security;
alter table public.sponsors enable row level security;
alter table public.event_mentors enable row level security;
alter table public.event_sponsors enable row level security;

create policy "public can view mentors for active events"
on public.mentors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.event_mentors event_mentor
    join public.events event on event.id = event_mentor.event_id
    where event_mentor.mentor_id = mentors.id
      and event.status = 'active'::public.event_status
  )
);

create policy "admins can view all mentors"
on public.mentors
for select
to authenticated
using (
  exists (
    select 1
    from public.user_info user_record
    where user_record.auth_user_id = auth.uid()
      and user_record.role_access = 'admin'::public.role_access_enum
  )
);

create policy "public can view sponsors for active events"
on public.sponsors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.event_sponsors event_sponsor
    join public.events event on event.id = event_sponsor.event_id
    where event_sponsor.sponsor_id = sponsors.id
      and event.status = 'active'::public.event_status
  )
);

create policy "admins can view all sponsors"
on public.sponsors
for select
to authenticated
using (
  exists (
    select 1
    from public.user_info user_record
    where user_record.auth_user_id = auth.uid()
      and user_record.role_access = 'admin'::public.role_access_enum
  )
);

create policy "public can view mentor links for active events"
on public.event_mentors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_mentors.event_id
      and event.status = 'active'::public.event_status
  )
);

create policy "admins can view all mentor links"
on public.event_mentors
for select
to authenticated
using (
  exists (
    select 1
    from public.user_info user_record
    where user_record.auth_user_id = auth.uid()
      and user_record.role_access = 'admin'::public.role_access_enum
  )
);

create policy "public can view sponsor links for active events"
on public.event_sponsors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_sponsors.event_id
      and event.status = 'active'::public.event_status
  )
);

create policy "admins can view all sponsor links"
on public.event_sponsors
for select
to authenticated
using (
  exists (
    select 1
    from public.user_info user_record
    where user_record.auth_user_id = auth.uid()
      and user_record.role_access = 'admin'::public.role_access_enum
  )
);

grant select on public.mentors to anon, authenticated;
grant select on public.sponsors to anon, authenticated;
grant select on public.event_mentors to anon, authenticated;
grant select on public.event_sponsors to anon, authenticated;
grant all on public.mentors to service_role;
grant all on public.sponsors to service_role;
grant all on public.event_mentors to service_role;
grant all on public.event_sponsors to service_role;
