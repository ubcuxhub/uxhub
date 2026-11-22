-- These checks share rls.sql's rollback transaction; no sign-in is needed.
reset role;
do $$
declare role_name text; table_name text;
begin
  if has_function_privilege('anon','public.admin_recent_membership_additions(timestamptz)','EXECUTE')
    or not has_function_privilege('authenticated','public.admin_recent_membership_additions(timestamptz)','EXECUTE') then
    raise exception 'Rolling membership aggregate grants are invalid';
  end if;
  foreach role_name in array array['anon','authenticated'] loop
    foreach table_name in array array['membership_awards','membership_award_months','membership_history_coverage'] loop
      if has_table_privilege(role_name, 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE') then
        raise exception '% has direct history privileges on %', role_name, table_name;
      end if;
    end loop;
    if has_function_privilege(role_name,'public.record_membership_award(uuid,timestamptz,text)','EXECUTE')
      or has_function_privilege(role_name,'public.rebuild_membership_history()','EXECUTE')
      or has_function_privilege(role_name,'public.fulfill_membership_purchase(uuid,timestamptz)','EXECUTE')
      or has_function_privilege(role_name,'public.reset_fixture_membership_history(uuid[])','EXECUTE') then
      raise exception '% can bypass the trusted writer boundary', role_name;
    end if;
  end loop;
end $$;

-- All-Unknown and zero-account data remain valid, distinct distributions.
savepoint history_major_cases;
update public.user_info set major = null;
select set_config('request.jwt.claim.sub', :'user_a_auth_user_id', true);
update public.user_info set role_access = 'admin' where id = :'user_a_id';
set local role authenticated;
do $$
declare result jsonb;
begin
  result := public.admin_major_distribution();
  if jsonb_array_length(result->'majors') <> 1
    or result->'majors'->0->>'major' <> 'Unknown'
    or (result->>'totalAccounts')::bigint <> (result->'majors'->0->>'count')::bigint then
    raise exception 'All-Unknown distribution is invalid: %', result;
  end if;
end $$;
rollback to savepoint history_major_cases;
reset role;
