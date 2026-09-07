-- Managers inherit operational admin access, while manager-only capabilities
-- use the narrower helper below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_info
    where auth_user_id = auth.uid()
      and role_access in (
        'admin'::public.role_access_enum,
        'manager'::public.role_access_enum
      )
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_info
    where auth_user_id = auth.uid()
      and role_access = 'manager'::public.role_access_enum
  );
$$;

revoke all on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated, service_role;

-- Admins keep directory visibility, but only managers may mutate another
-- account. Every authenticated user retains the existing safe own-row update.
drop policy if exists "user_info: admins insert" on public.user_info;
drop policy if exists "user_info: admins update" on public.user_info;
drop policy if exists "user_info: admins delete" on public.user_info;

create policy "user_info: managers insert"
  on public.user_info
  for insert
  to authenticated
  with check (public.is_manager());

create policy "user_info: managers update"
  on public.user_info
  for update
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "user_info: managers delete"
  on public.user_info
  for delete
  to authenticated
  using (public.is_manager());

create or replace function public.guard_user_info_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_manager() then
    return new;
  end if;

  if new.role_access is distinct from old.role_access
     or new.membership_type_id is distinct from old.membership_type_id
     or new.membership_pre_ordered_type_id is distinct from old.membership_pre_ordered_type_id
     or new.membership_expires_at is distinct from old.membership_expires_at
     or new.square_customer_id is distinct from old.square_customer_id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.email is distinct from old.email
     or new.user_type is distinct from old.user_type
     or new.student_number is distinct from old.student_number
  then
    raise exception 'Cannot modify privileged columns on user_info';
  end if;

  return new;
end;
$$;

-- Role changes must pass through set_user_role so the last-manager invariant
-- is enforced in the same transaction as the update.
revoke update (role_access) on public.user_info from authenticated;

create or replace function public.set_user_role(
  p_target_user_id uuid,
  p_role public.role_access_enum
)
returns public.role_access_enum
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_role public.role_access_enum;
  manager_count integer;
begin
  -- Serialize all role changes so two concurrent demotions cannot both observe
  -- another manager and remove the final two accounts together.
  perform pg_advisory_xact_lock(784921367);

  if not public.is_manager() then
    raise exception 'Only managers can change role access'
      using errcode = '42501';
  end if;

  if p_role is null then
    raise exception 'A role is required'
      using errcode = '22004';
  end if;

  select role_access
  into previous_role
  from public.user_info
  where id = p_target_user_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Active user not found'
      using errcode = 'P0002';
  end if;

  if previous_role = p_role then
    return previous_role;
  end if;

  if previous_role = 'manager'::public.role_access_enum
     and p_role <> 'manager'::public.role_access_enum
  then
    select count(*)
    into manager_count
    from public.user_info
    where role_access = 'manager'::public.role_access_enum
      and deleted_at is null;

    if manager_count <= 1 then
      raise exception 'The final manager cannot be demoted';
    end if;
  end if;

  update public.user_info
  set role_access = p_role
  where id = p_target_user_id;

  return p_role;
end;
$$;

revoke all on function public.set_user_role(uuid, public.role_access_enum)
  from public, anon, authenticated;
grant execute on function public.set_user_role(uuid, public.role_access_enum)
  to authenticated;

drop policy if exists "app_settings: admins update" on public.app_settings;
create policy "app_settings: managers update"
  on public.app_settings
  for update
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

-- Production bootstrap. Fresh local databases have no users at migration time;
-- the local seed supplies its own manager fixture instead. More than one match
-- is always an error; deployment verification must confirm that production
-- produced the single expected match before the manager-aware app is released.
do $$
declare
  bootstrap_matches integer;
begin
  select count(*)
  into bootstrap_matches
  from public.user_info
  where lower(email) = 'dongjiayang123@gmail.com'
    and deleted_at is null;

  if bootstrap_matches > 1 then
    raise exception 'Initial manager email matched more than one active user';
  end if;

  if bootstrap_matches = 1 then
    update public.user_info
    set role_access = 'manager'::public.role_access_enum
    where lower(email) = 'dongjiayang123@gmail.com'
      and deleted_at is null;
  else
    raise notice 'Initial manager account is absent; no production bootstrap was applied';
  end if;
end;
$$;
