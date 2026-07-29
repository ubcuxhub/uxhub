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
      and role_access = 'admin'::public.role_access_enum
  );
$$;

create or replace function public.current_user_info_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.user_info
  where auth_user_id = auth.uid();
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_user_info_id() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.current_user_info_id() to authenticated, service_role;

drop policy if exists "visibility" on public.user_info;
drop policy if exists "admin_select_all" on public.user_info;
drop policy if exists "allow current user to update its own row" on public.user_info;
drop policy if exists "admin_delete" on public.user_info;
drop policy if exists "admin_insert" on public.user_info;
drop policy if exists "admin_update" on public.user_info;

create policy "user_info: read own row"
  on public.user_info
  for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "user_info: admins read all"
  on public.user_info
  for select
  to authenticated
  using (public.is_admin());

create policy "user_info: update own row"
  on public.user_info
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "user_info: admins insert"
  on public.user_info
  for insert
  to authenticated
  with check (public.is_admin());

create policy "user_info: admins update"
  on public.user_info
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "user_info: admins delete"
  on public.user_info
  for delete
  to authenticated
  using (public.is_admin());

drop trigger if exists prevent_role_access_change_trigger on public.user_info;
drop function if exists public.prevent_role_access_change();

create or replace function public.guard_user_info_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
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

revoke all on function public.guard_user_info_privileged_columns() from public, anon, authenticated;

create trigger user_info_guard_privileged_columns
  before update on public.user_info
  for each row
  execute function public.guard_user_info_privileged_columns();

revoke update on public.user_info from anon, authenticated;
grant update (
  name,
  preferred_pronouns,
  phone,
  faculty,
  major,
  year,
  dietary_restrictions,
  newsletter,
  role_access,
  membership_type_id
) on public.user_info to authenticated;
