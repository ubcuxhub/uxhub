-- Profile rows should only created by ensureUserInfo flow or managers
drop policy if exists "Users can insert own user_info" on public.user_info;
