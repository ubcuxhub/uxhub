-- Included by rls.sql inside its rollback-only fixture transaction.
-- Admins read the audit log, nobody else does, and nothing writes to it
-- through PostgREST.
--
-- Every assertion here is scoped to the rows this file writes. By the time it
-- runs, rls.sql has already made admin-attributed edits of its own -- user A
-- is an admin from partway through, and the trigger picks up `auth.uid()` --
-- so the table is not empty and a count over all of it proves nothing.

do $$
declare
  action_name text;
begin
  if not has_table_privilege('authenticated', 'public.audit_events', 'SELECT') then
    raise exception 'admins cannot read audit_events';
  end if;

  -- anon has no access at all: the migration revokes the default grants and
  -- gives SELECT back to authenticated only.
  if has_table_privilege('anon', 'public.audit_events', 'SELECT') then
    raise exception 'anon is granted SELECT on audit_events';
  end if;

  -- An audit log a client can write is not one.
  foreach action_name in array array['INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.audit_events', action_name)
       or has_table_privilege('anon', 'public.audit_events', action_name) then
      raise exception 'client % unexpectedly granted on audit_events', action_name;
    end if;
  end loop;
end;
$$;

-- The trigger records a change only when its actor is an admin. User A is one
-- by this point; user B is a basic member. Each edit below writes a value
-- unique to this file, so an assertion can find exactly its own entry.
\o /dev/null
select set_config('audit.user_a_id', :'user_a_id', true);
select set_config('audit.user_b_id', :'user_b_id', true);
select set_config('app.audit_actor_id', :'user_b_id', true);
\o
update public.user_info set major = 'Audit gate, non-admin' where id = :'user_b_id';

do $$
begin
  if exists (
    select 1 from public.audit_events
    where changes -> 'major' ->> 'to' = 'Audit gate, non-admin'
  ) then
    raise exception 'an edit by a non-admin was logged as an admin change';
  end if;
end;
$$;

\o /dev/null
select set_config('app.audit_actor_id', :'user_a_id', true);
\o
update public.user_info set major = 'Audit gate, admin' where id = :'user_b_id';

do $$
declare
  logged public.audit_events%rowtype;
begin
  select * into logged from public.audit_events
  where changes -> 'major' ->> 'to' = 'Audit gate, admin';
  if not found then
    raise exception 'an admin edit was not logged';
  end if;
  if logged.source <> 'admin_change'
     or logged.action <> 'user_info.updated'
     or logged.subject_table <> 'user_info'
     or logged.subject_id <> current_setting('audit.user_b_id')::uuid then
    raise exception 'unexpected audit entry: % % % %',
      logged.source, logged.action, logged.subject_table, logged.subject_id;
  end if;
  if logged.actor_id <> current_setting('audit.user_a_id')::uuid then
    raise exception 'the entry names % as the actor', logged.actor_id;
  end if;
end;
$$;

\o /dev/null
select set_config('app.audit_actor_id', '', true);
select set_config('request.jwt.claims', '{}', true);
\o
set local role anon;
do $$
declare
  visible_count integer;
begin
  -- anon holds no grant, so this raises rather than returning an empty set.
  -- Reaching the next line at all means the revoke was lost.
  select count(*) into visible_count from public.audit_events;
  raise exception 'anon can read audit_events, saw %', visible_count;
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

-- Signed in, but not an admin. User B has no auth account, so this uses the
-- unprofiled one, for which is_admin() is likewise false.
\o /dev/null
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'unprofiled_auth_user_id',
    'email', :'unprofiled_email',
    'role', 'authenticated'
  )::text,
  true
);
\o
set local role authenticated;
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.audit_events;
  if visible_count <> 0 then
    raise exception 'a signed-in non-admin can read audit_events, saw %', visible_count;
  end if;
end;
$$;
reset role;

-- User A was promoted to admin earlier in rls.sql.
\o /dev/null
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_a_auth_user_id',
    'email', :'user_a_email',
    'role', 'authenticated'
  )::text,
  true
);
\o
set local role authenticated;
do $$
begin
  if not exists (
    select 1 from public.audit_events
    where changes -> 'major' ->> 'to' = 'Audit gate, admin'
  ) then
    raise exception 'an admin cannot read the audit entry written above';
  end if;
end;
$$;
reset role;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o
