drop policy if exists "user_info: read own row" on public.user_info;
drop policy if exists "user_info: admins read all" on public.user_info;
drop policy if exists "user_info: update own row" on public.user_info;
drop policy if exists "user_info: admins insert" on public.user_info;
drop policy if exists "user_info: admins update" on public.user_info;
drop policy if exists "user_info: admins delete" on public.user_info;

drop trigger if exists user_info_guard_privileged_columns on public.user_info;
drop function if exists public.guard_user_info_privileged_columns();
drop function if exists public.current_user_info_id();

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
declare
  user_role public.role_access_enum;
begin
  select role_access
  into user_role
  from public.user_info
  where auth_user_id = auth.uid();

  return user_role = 'admin';
end;
$$;

create policy "visibility"
  on public.user_info
  for select
  to anon, authenticated
  using (true);

create policy "admin_select_all"
  on public.user_info
  for select
  to authenticated
  using (role_access = 'admin'::public.role_access_enum);

create policy "allow current user to update its own row"
  on public.user_info
  for update
  to authenticated
  using (email = (select auth.email()))
  with check (email = (select auth.email()));

create policy "admin_delete"
  on public.user_info
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_info me
      where me.auth_user_id = (select auth.uid())
        and me.role_access = 'admin'::public.role_access_enum
    )
  );

create policy "admin_insert"
  on public.user_info
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_info me
      where me.auth_user_id = (select auth.uid())
        and me.role_access = 'admin'::public.role_access_enum
    )
  );

create policy "admin_update"
  on public.user_info
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_info me
      where me.auth_user_id = (select auth.uid())
        and me.role_access = 'admin'::public.role_access_enum
    )
  )
  with check (
    exists (
      select 1
      from public.user_info me
      where me.auth_user_id = (select auth.uid())
        and me.role_access = 'admin'::public.role_access_enum
    )
  );

create or replace function public.prevent_role_access_change()
returns trigger
language plpgsql
as $$
begin
  if old.role_access is distinct from new.role_access then
    if not public.is_admin() then
      raise exception 'Only admins can change role_access';
    end if;
  end if;

  return new;
end;
$$;

create trigger prevent_role_access_change_trigger
  before update on public.user_info
  for each row
  execute function public.prevent_role_access_change();

grant update on public.user_info to anon, authenticated;
