-- Club-wide application settings, starting with the membership term end date.
--
-- Memberships were previously stamped with "one year from the moment the
-- payment was fulfilled", so every member had their own anniversary. UX Hub
-- runs on terms, and admins need one shared end date that applies to every
-- membership regardless of when it was bought.
--
-- `membership_term_ends_at` is that date. It is a ceiling, not a replacement:
-- a member's effective expiry is the earlier of their own
-- `user_info.membership_expires_at` and this value. Evaluating it at read time
-- is what makes the date movable — changing it takes effect for everyone on the
-- next request, with no backfill, and extending it brings members back rather
-- than stranding them. Null means no ceiling, which is the original behavior.

create table public.app_settings (
  -- Singleton. A boolean primary key constrained to `true` means the row that
  -- exists is the only row that can ever exist, so readers never have to pick.
  id boolean primary key default true check (id),
  membership_term_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.user_info(id)
);

comment on table public.app_settings is
  'Single-row table of club-wide settings. The `check (id)` on a boolean primary key keeps it a singleton.';

comment on column public.app_settings.membership_term_ends_at is
  'Ceiling on every membership expiry. A member is active while both their own membership_expires_at and this date are in the future. Null means no ceiling.';

insert into public.app_settings (id) values (true);

create trigger update_app_settings_updated_at
  before update on public.app_settings
  for each row
  execute function public.update_updated_at_column();

alter table public.app_settings enable row level security;

-- Readable by everyone, including anonymous visitors: the marketing navbar and
-- calls to action decide between "become a member" and "view my membership"
-- client-side, so the browser has to be able to read the ceiling.
create policy "app_settings: readable by everyone"
  on public.app_settings
  for select
  using (true);

create policy "app_settings: admins update"
  on public.app_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert or delete policies, deliberately. The singleton row is seeded
-- above and must not be duplicated or removed.
revoke insert, delete on public.app_settings from anon, authenticated;
