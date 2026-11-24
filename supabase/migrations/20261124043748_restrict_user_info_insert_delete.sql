-- Browser clients can no longer insert or delete user_info rows.
--
-- The app never does either with a user session: the service role creates
-- profiles (ensureUserInfo), and account deletion anonymizes through
-- delete_account. But "managers insert" and "managers delete", plus the
-- remote schema's GRANT ALL, let any manager session hard-delete a member
-- straight from the browser, which skips the anonymization and photo cleanup,
-- cascades to purchases and team memberships, and can remove other managers
-- past set_user_role's final-manager check. INSERT took any role_access or
-- auth_user_id, since the privileged-column guard runs on UPDATE only.
--
-- The service role bypasses RLS and keeps its own grants, so server-side
-- writes are unaffected.

drop policy if exists "user_info: managers insert" on public.user_info;
drop policy if exists "user_info: managers delete" on public.user_info;

revoke insert, delete on public.user_info from anon, authenticated;
