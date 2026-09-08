-- Warning running this will cause a regression :P
-- this policy permits a signed-in user to create their own user_info row 
-- with any role_access value
create policy "Users can insert own user_info"
  on public.user_info
  for insert
  to authenticated
  with check (auth_user_id = auth.uid());
