/*
 * An attributable write path for a manager's edits to a member's profile.
 *
 * `log_admin_change` reads the actor from `app.audit_actor_id`, falling back to
 * `auth.uid()`. Neither resolves for the users drawer: it writes with the
 * service-role key, which carries no session, and supabase-js cannot set the
 * setting because each PostgREST request runs in its own transaction. Every
 * entry would name no actor, and the History tab needs one.
 *
 * So the write moves inside a function. Called on the manager's own session it
 * sets the actor and performs the update in one transaction, which is what the
 * trigger needs. SECURITY DEFINER because `authenticated` deliberately has no
 * UPDATE grant on first_name, last_name, email, student_number or
 * order_date_deprecated (see harden_user_info_rls) -- the drawer may edit them,
 * a member editing their own row may not.
 *
 * That makes this function the privilege boundary, so it re-checks the caller
 * and the columns itself rather than trusting what the action already checked.
 */

-- The columns a manager may edit, mirroring MANAGER_USER_FIELDS in
-- src/features/admin. Two absences are deliberate: role_access moves through
-- set_user_role, which keeps the last managers from locking everyone out, and
-- email is the sign-in address of a linked account, so it goes through
-- saveManagerUserDetailsAction's own check rather than a generic patch.
create function public.admin_user_editable_columns() returns text[]
language sql immutable set search_path = public as $$
  select array[
    'first_name', 'last_name', 'phone', 'newsletter', 'student_number',
    'faculty', 'major', 'year', 'membership_type_id', 'order_date_deprecated'
  ]::text[];
$$;
revoke all on function public.admin_user_editable_columns() from public, anon, authenticated;

create function public.admin_update_user_info(
  p_user_id uuid,
  p_patch jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_key   text;
begin
  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22004';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'A patch object is required' using errcode = '22004';
  end if;

  if not public.is_manager() then
    raise exception 'Only managers can edit a member profile'
      using errcode = '42501';
  end if;

  -- A manager reaching the function directly must not get further than one
  -- reaching it through the drawer.
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any (public.admin_user_editable_columns())) then
      raise exception 'This user field cannot be edited: %', v_key
        using errcode = '42501';
    end if;
  end loop;

  select id into v_actor from public.user_info where auth_user_id = auth.uid();
  if v_actor is null then
    raise exception 'No profile is linked to this account' using errcode = '42501';
  end if;

  -- Same transaction as the update below, which is the whole point: the
  -- trigger reads this while the row is being written.
  perform set_config('app.audit_actor_id', v_actor::text, true);

  -- `?` rather than coalesce, so clearing a field is distinguishable from
  -- leaving it alone.
  update public.user_info u set
    first_name = case when p_patch ? 'first_name'
      then p_patch ->> 'first_name' else u.first_name end,
    last_name = case when p_patch ? 'last_name'
      then p_patch ->> 'last_name' else u.last_name end,
    phone = case when p_patch ? 'phone'
      then p_patch ->> 'phone' else u.phone end,
    newsletter = case when p_patch ? 'newsletter'
      then (p_patch ->> 'newsletter')::boolean else u.newsletter end,
    student_number = case when p_patch ? 'student_number'
      then (p_patch ->> 'student_number')::bigint else u.student_number end,
    faculty = case when p_patch ? 'faculty'
      then p_patch ->> 'faculty' else u.faculty end,
    major = case when p_patch ? 'major'
      then p_patch ->> 'major' else u.major end,
    year = case when p_patch ? 'year'
      then (p_patch ->> 'year')::public.uni_year else u.year end,
    membership_type_id = case when p_patch ? 'membership_type_id'
      then (p_patch ->> 'membership_type_id')::uuid else u.membership_type_id end,
    order_date_deprecated = case when p_patch ? 'order_date_deprecated'
      then (p_patch ->> 'order_date_deprecated')::date else u.order_date_deprecated end
  where u.id = p_user_id
    and u.deleted_at is null;

  if not found then
    raise exception 'No active profile with that id' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_user_info(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_user_info(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_user_info(uuid, jsonb) to service_role;
