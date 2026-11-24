-- Drop two unused SECURITY DEFINER functions from the remote schema.
--
-- get_user_info_id() (replaced by current_user_info_id()) and
-- is_authenticated() have no pinned search_path and EXECUTE granted to anon.
-- No code, policy or later function calls them. They are the last definer
-- functions the Supabase security advisor flags for a mutable search_path.
--
-- No cascade: if something did depend on them, the migration should fail
-- rather than silently take a policy down with it.

drop function if exists public.get_user_info_id();
drop function if exists public.is_authenticated();
