-- The final manager can't delete their own account.
--
-- delete_account demotes the account to 'basic' as it anonymizes it, without
-- the final-manager check set_user_role enforces. The only manager deleting
-- their account left nobody able to change roles, Club Settings or
-- membership tiers until someone edited the database by hand.
--
-- Take set_user_role's advisory lock so a concurrent demotion and deletion
-- can't both see the other manager, and refuse with SQLSTATE 55000
-- (object_not_in_prerequisite_state), which deleteAccountAction maps to a
-- message. The rest of the body is unchanged from 20260906120000.

create or replace function public.delete_account(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_info_id uuid;
  v_role public.role_access_enum;
begin
  if p_auth_user_id is null then
    raise exception 'An auth user id is required to delete an account.';
  end if;

  perform pg_advisory_xact_lock(784921367);

  select id, role_access
  into v_user_info_id, v_role
  from public.user_info
  where auth_user_id = p_auth_user_id
  for update;

  if v_user_info_id is null then
    raise exception 'No profile is linked to this account.';
  end if;

  if v_role = 'manager'::public.role_access_enum
     and not exists (
       select 1
       from public.user_info
       where role_access = 'manager'::public.role_access_enum
         and deleted_at is null
         and id <> v_user_info_id
     )
  then
    raise exception 'The final manager cannot delete their account'
      using errcode = '55000';
  end if;

  update public.user_info
  set
    auth_user_id = null,
    email = 'deleted+' || id || '@deleted.uxhub.invalid',
    first_name = 'Deleted',
    last_name = 'member',
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
  where id = v_user_info_id;

  delete from auth.users
  where id = p_auth_user_id;
end;
$$;
