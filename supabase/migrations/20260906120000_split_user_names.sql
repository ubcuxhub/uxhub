alter table public.user_info
  add column first_name text,
  add column last_name text;

with normalized_names as (
  select
    id,
    regexp_replace(btrim(name), '\s+', ' ', 'g') as full_name
  from public.user_info
)
update public.user_info as user_info
set
  first_name = split_part(normalized_names.full_name, ' ', 1),
  last_name = case
    when strpos(normalized_names.full_name, ' ') > 0
      then substr(
        normalized_names.full_name,
        strpos(normalized_names.full_name, ' ') + 1
      )
    else null
  end
from normalized_names
where user_info.id = normalized_names.id;

do $$
declare
  invalid_count integer;
begin
  select count(*)
  into invalid_count
  from public.user_info
  where nullif(btrim(first_name), '') is null
     or nullif(btrim(last_name), '') is null;

  if invalid_count > 0 then
    raise exception
      'Cannot split user_info.name into required first_name and last_name for % row(s). Fix those names before applying this migration.',
      invalid_count;
  end if;
end;
$$;

alter table public.user_info
  alter column first_name set not null,
  alter column last_name set not null,
  add constraint user_info_first_name_trimmed_nonempty
    check (first_name = btrim(first_name) and first_name <> ''),
  add constraint user_info_last_name_trimmed_nonempty
    check (last_name = btrim(last_name) and last_name <> '');

grant update (first_name, last_name)
  on public.user_info
  to authenticated;

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

  -- Keep the existing account-deletion behavior while replacing the old name
  -- assignment with the two required name columns.
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
  where auth_user_id = p_auth_user_id
  returning id into v_user_info_id;

  if v_user_info_id is null then
    raise exception 'No profile is linked to this account.';
  end if;

  delete from auth.users
  where id = p_auth_user_id;
end;
$$;

alter table public.user_info
  drop column name;
