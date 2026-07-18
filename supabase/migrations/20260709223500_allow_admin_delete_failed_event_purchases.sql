drop policy if exists "admin can select purchases" on public.purchases;
drop policy if exists "admin can delete failed event purchases" on public.purchases;

create policy "admin can select purchases"
on public.purchases
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

create policy "admin can delete failed event purchases"
on public.purchases
for delete
to authenticated
using (
  kind = 'event_ticket'
  and status = 'failed'
  and event_id is not null
  and exists (
    select 1
    from public.user_info u
    where u.auth_user_id = auth.uid()
      and u.role_access = 'admin'::public.role_access_enum
  )
);
