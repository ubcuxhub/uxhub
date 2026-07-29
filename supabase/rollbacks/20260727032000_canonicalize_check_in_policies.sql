drop policy if exists "check-ins: admins read" on public.check_ins;
drop policy if exists "check-ins: admins insert" on public.check_ins;
drop policy if exists "check-ins: admins update" on public.check_ins;
drop policy if exists "check-ins: admins delete" on public.check_ins;

create policy "admin can view"
  on public.check_ins for select to public using (public.is_admin());
create policy "admin can insert"
  on public.check_ins for insert to authenticated with check (public.is_admin());
create policy "admin can update"
  on public.check_ins for update to public
  using (public.is_admin()) with check (public.is_admin());
create policy "admin can delete"
  on public.check_ins for delete to authenticated using (public.is_admin());
