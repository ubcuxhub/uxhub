-- Included by rls.sql inside its rollback-only fixture transaction.
-- Admins read the audit log, nobody else does, and nothing writes to it
-- through PostgREST.

do $$
declare
  action_name text;
begin
  if not has_table_privilege('authenticated', 'public.audit_events', 'SELECT') then
    raise exception 'admins cannot read audit_events';
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

-- The trigger only records a change whose actor is an admin, so nothing earlier
-- in this file has written a row: the fixtures were created as the superuser
-- with no claims set. These two edits exercise both sides of that gate.
--
-- User A is an admin by this point; user B is a basic member.
\o /dev/null
select set_config('app.audit_actor_id', :'user_b_id', true);
\o
update public.user_info set major = 'Audit gate, non-admin' where id = :'user_b_id';

do $$
declare
  written integer;
begin
  select count(*) into written from public.audit_events;
  if written <> 0 then
    raise exception 'an edit by a non-admin was logged as an admin change, saw %', written;
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
  select * into logged from public.audit_events;
  if not found then
    raise exception 'an admin edit was not logged';
  end if;
  if logged.source <> 'admin_change'
     or logged.action <> 'user_info.updated'
     or logged.subject_table <> 'user_info' then
    raise exception 'unexpected audit entry: % % %',
      logged.source, logged.action, logged.subject_table;
  end if;
  if logged.changes -> 'major' ->> 'to' <> 'Audit gate, admin' then
    raise exception 'audit entry did not record the new value: %', logged.changes;
  end if;
end;
$$;

-- An event is edited through its children as much as through its own row, and
-- those entries have to land on the event or the History tab will not find
-- them.
\o /dev/null
select set_config('app.audit_actor_id', :'user_a_id', true);
select set_config('audit.event_id', :'event_id', true);
\o
insert into public.event_agenda_days (event_id, title, date)
values (:'event_id', 'Audit coverage day', current_date);

do $$
declare
  logged public.audit_events%rowtype;
begin
  select * into logged from public.audit_events
  where action = 'event_agenda_days.created';
  if not found then
    raise exception 'an agenda day added by an admin was not logged';
  end if;
  if logged.subject_table <> 'events'
     or logged.subject_id <> current_setting('audit.event_id')::uuid then
    raise exception 'agenda entry landed on % %, not the event',
      logged.subject_table, logged.subject_id;
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
  select count(*) into visible_count from public.audit_events;
  if visible_count <> 0 then
    raise exception 'anon can read audit_events, saw %', visible_count;
  end if;
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
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.audit_events
  where source = 'admin_change';
  if visible_count = 0 then
    raise exception 'an admin cannot read the audit entry just written';
  end if;
end;
$$;
reset role;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o
