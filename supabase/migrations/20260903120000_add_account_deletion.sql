-- Self-serve account deletion.
--
-- "Delete" here means: destroy the login for good, and strip every piece of
-- personal information from the profile row, while leaving the row itself in
-- place so purchase receipts and event attendance history stay intact for club
-- accounting and headcounts.
--
-- The schema also forces this shape. `user_info.auth_user_id` references
-- `auth.users` with no ON DELETE clause, so the auth row cannot go while the
-- profile points at it; `event_registrations.user_id` references `user_info`
-- with no ON DELETE clause, so the profile row cannot go while any
-- registration or review points at it. Nulling `auth_user_id` satisfies both.

alter table public.user_info
  add column deleted_at timestamptz;

comment on column public.user_info.deleted_at is
  'Set when the member deleted their own account. The row is anonymized and its auth user destroyed; it is retained only so purchases and event registrations keep a referent.';

create or replace function public.delete_account(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_info_id uuid;
begin
  if p_auth_user_id is null then
    raise exception 'An auth user id is required to delete an account.';
  end if;

  -- Anonymize first: the update releases the foreign key to auth.users, which
  -- the delete below depends on. Both run in the caller's transaction, so a
  -- failure at either step leaves the account fully intact.
  --
  -- `email` is unique and must stay that way. Rewriting it is not cosmetic:
  -- `ensureUserInfo` adopts an existing row whose `auth_user_id` is null when
  -- the email matches, so a deleted row that kept its address would be silently
  -- re-claimed — along with its history — by the next sign-up from that person.
  update public.user_info
  set
    auth_user_id = null,
    email = 'deleted+' || id || '@deleted.uxhub.invalid',
    name = 'Deleted member',
    phone = null,
    preferred_pronouns = null,
    student_number = null,
    faculty = null,
    faculty_email = null,
    major = null,
    year = null,
    dietary_restrictions = null,
    school_institution = null,
    student_status = null,
    square_customer_id = null,
    newsletter = false,
    role_access = 'basic'::public.role_access_enum,
    deleted_at = now()
  where auth_user_id = p_auth_user_id
  returning id into v_user_info_id;

  if v_user_info_id is null then
    raise exception 'No profile is linked to this account.';
  end if;

  -- auth.sessions, auth.identities, auth.refresh_tokens and auth.mfa_factors
  -- all cascade off auth.users, so this performs the same cleanup as the GoTrue
  -- admin delete endpoint while staying inside this transaction.
  delete from auth.users
  where id = p_auth_user_id;
end;
$$;

-- Callable only by the service role, from a server action that has already
-- established the caller's identity. Mirrors delete_event_atomically.
revoke all on function public.delete_account(uuid)
  from public, anon, authenticated;

grant execute on function public.delete_account(uuid)
  to service_role;
