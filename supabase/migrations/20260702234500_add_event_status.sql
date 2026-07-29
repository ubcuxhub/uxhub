do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_status') then
    create type public.event_status as enum ('draft', 'active', 'archived');
  end if;
end $$;

alter table public.events
add column if not exists status public.event_status not null default 'draft';

update public.events
set status = 'active'
where status = 'draft';

drop policy if exists "everyone can view events" on public.events;
drop policy if exists "everyone can view active events" on public.events;
drop policy if exists "admin_select_all_events" on public.events;

create policy "everyone can view active events"
on public.events
for select
to authenticated, anon
using (status = 'active'::public.event_status);

create policy "admin_select_all_events"
on public.events
for select
to authenticated
using (
  exists (
    select 1
    from public.user_info u
    where u.auth_user_id = auth.uid()
      and u.role_access = 'admin'::public.role_access_enum
  )
);
