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
select set_config('audit.event_id', :'event_id', true);
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

-- An event is edited through its children as much as through its own row, and
-- those entries have to land on the event or the History tab will not find
-- them. Insert, update and delete all count: adding a speaker is the edit, and
-- there is no diff on the event row to see.
-- Dates of their own: (event_id, date) is unique and rls.sql already gave
-- this event an agenda for today.
insert into public.event_agenda_days (event_id, title, date)
values (:'event_id', 'Audit coverage day', date '2099-03-01')
returning id \gset audit_day_

insert into public.event_agenda_items (
  event_agenda_day_id, title, start_time, end_time
)
values (:'audit_day_id', 'Audit coverage item', '10:00', '11:00')
returning id \gset audit_item_

update public.event_agenda_items set room = 'A101' where id = :'audit_item_id';
delete from public.event_agenda_items where id = :'audit_item_id';

do $$
declare
  event_id uuid := current_setting('audit.event_id')::uuid;
  wrong    text;
begin
  -- Every entry this block wrote belongs to the event, the item included:
  -- it names only its day and has to be resolved through it.
  select string_agg(action || ' -> ' || coalesce(subject_table, 'null'), ', ')
  into wrong
  from public.audit_events
  where (changes -> 'title' ->> 'to' in ('Audit coverage day', 'Audit coverage item')
         or changes -> 'title' ->> 'from' = 'Audit coverage item'
         or changes -> 'room' ->> 'to' = 'A101')
    and (subject_table is distinct from 'events' or subject_id is distinct from event_id);
  if wrong is not null then
    raise exception 'agenda entries landed off the event: %', wrong;
  end if;

  if not exists (
    select 1 from public.audit_events
    where action = 'event_agenda_days.created'
      and changes -> 'title' ->> 'to' = 'Audit coverage day'
  ) then
    raise exception 'adding an agenda day was not logged';
  end if;
  if not exists (
    select 1 from public.audit_events
    where action = 'event_agenda_items.created'
      and changes -> 'title' ->> 'to' = 'Audit coverage item'
  ) then
    raise exception 'adding an agenda item was not logged';
  end if;
  if not exists (
    select 1 from public.audit_events
    where action = 'event_agenda_items.updated'
      and changes -> 'room' ->> 'to' = 'A101'
  ) then
    raise exception 'editing an agenda item was not logged';
  end if;
  if not exists (
    select 1 from public.audit_events
    where action = 'event_agenda_items.deleted'
      and changes -> 'title' ->> 'from' = 'Audit coverage item'
      and changes -> 'title' ->> 'to' is null
  ) then
    raise exception 'removing an agenda item was not logged as a delete';
  end if;
end;
$$;

-- A member touching a child row is not an admin change.
\o /dev/null
select set_config('app.audit_actor_id', :'user_b_id', true);
\o
insert into public.event_agenda_days (event_id, title, date)
values (:'event_id', 'Audit coverage, non-admin', date '2099-03-02');

do $$
begin
  if exists (
    select 1 from public.audit_events
    where changes -> 'title' ->> 'to' = 'Audit coverage, non-admin'
  ) then
    raise exception 'an agenda day added by a non-admin was logged';
  end if;
end;
$$;

-- Club Settings is a single row keyed by a boolean, so it logs with no
-- subject and `action` carries the meaning. Counted as a delta, because
-- rls.sql edits app_settings before this file runs.
\o /dev/null
select set_config('app.audit_actor_id', :'user_a_id', true);
select set_config(
  'audit.settings_before',
  (select count(*)::text from public.audit_events where action = 'app_settings.updated'),
  true
);
\o
update public.app_settings set membership_term_ends_at = now() - interval '36 days';

do $$
declare
  added integer;
begin
  select count(*) - current_setting('audit.settings_before')::integer into added
  from public.audit_events where action = 'app_settings.updated';
  if added <> 1 then
    raise exception 'a Club Settings change added % entries, expected 1', added;
  end if;

  if exists (
    select 1 from public.audit_events
    where action = 'app_settings.updated'
      and (subject_table is not null or subject_id is not null)
  ) then
    raise exception 'a Club Settings entry carries a subject';
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
