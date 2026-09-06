\set ON_ERROR_STOP on

begin;

select id, auth_user_id, email
from public.user_info
where auth_user_id is not null
limit 1
\gset user_a_

update public.user_info
set role_access = 'basic'
where id = :'user_a_id';

insert into public.user_info (email, first_name, last_name, role_access)
values ('rls-user-b@example.test', 'RLS', 'User B', 'basic')
returning id \gset user_b_

insert into public.events (
  name, description, regular_price, member_price, max_capacity, slug,
  registration_start_time, registration_end_time, status
)
values (
  'RLS Event', 'RLS test event', 0, 0, 10, 'rls-event',
  now() - interval '1 hour', now() + interval '1 hour', 'active'
)
returning id \gset event_

insert into public.event_application_questions (
  event_id, question, response_type
)
values (:'event_id', 'Why?', 'long_text')
returning id \gset question_

insert into public.mentors (full_name)
values ('RLS Mentor')
returning id \gset mentor_

insert into public.event_mentors (event_id, mentor_id)
values (:'event_id', :'mentor_id');

insert into public.sponsors (name)
values ('RLS Sponsor')
returning id \gset sponsor_

insert into public.event_sponsors (event_id, sponsor_id)
values (:'event_id', :'sponsor_id');

insert into public.check_in_sessions (event_id, name, start_time, end_time)
values (:'event_id', 'RLS Session', now(), now() + interval '1 hour');

insert into public.event_registrations (event_id, user_id, status)
values (:'event_id', :'user_b_id', 'pending')
returning id \gset user_b_registration_

insert into public.event_application_responses (
  event_registration_id,
  event_application_question_id,
  response
)
values (
  :'user_b_registration_id',
  :'question_id',
  'User B response'
);

set local role anon;
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.user_info;
  if visible_count <> 0 then
    raise exception 'anon can read user_info';
  end if;
end;
$$;
reset role;

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
select set_config('rls.event_id', :'event_id', true);
select set_config('rls.user_b_id', :'user_b_id', true);
select set_config('rls.question_id', :'question_id', true);
\o

set local role authenticated;

do $$
declare
  visible_count integer;
  changed_count integer;
begin
  select count(*) into visible_count from public.user_info;
  if visible_count <> 1 then
    raise exception 'user A should see exactly their own user_info row, saw %', visible_count;
  end if;

  update public.user_info
  set first_name = first_name
  where auth_user_id = auth.uid();
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'user A could not update a safe profile field';
  end if;

  begin
    update public.user_info
    set user_type = 'nonUbc'
    where auth_user_id = auth.uid();
    raise exception 'user A directly changed eligibility';
  exception
    when insufficient_privilege then
      null;
  end;

  select count(*) into visible_count from public.event_registrations;
  if visible_count <> 0 then
    raise exception 'user A can read user B registration';
  end if;

  begin
    insert into public.event_registrations (event_id, user_id, status)
    values (
      current_setting('rls.event_id')::uuid,
      public.current_user_info_id(),
      'accepted'
    );
    raise exception 'user A inserted a pre-approved registration';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;

  insert into public.event_registrations (event_id, user_id, status)
  values (
    current_setting('rls.event_id')::uuid,
    public.current_user_info_id(),
    'pending'
  );

  update public.event_registrations
  set status = 'accepted'
  where user_id = current_setting('rls.user_b_id')::uuid;
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'user A updated user B registration';
  end if;

  update public.event_registrations
  set status = 'accepted'
  where user_id = public.current_user_info_id();
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'user A updated their own authorization status';
  end if;

  insert into public.event_application_responses (
    event_registration_id,
    event_application_question_id,
    response
  )
  select id, current_setting('rls.question_id')::uuid, 'User A response'
  from public.event_registrations
  where user_id = public.current_user_info_id();

  select count(*) into visible_count
  from public.event_application_responses;
  if visible_count <> 1 then
    raise exception 'user A should see one own response, saw %', visible_count;
  end if;

  select count(*) into visible_count
  from public.event_application_questions;
  if visible_count <> 1 then
    raise exception 'user A cannot read open application questions';
  end if;

  select count(*) into visible_count
  from public.check_in_sessions;
  if visible_count <> 1 then
    raise exception 'registered user cannot read their check-in session';
  end if;

  select count(*) into visible_count from public.mentors;
  if visible_count <> 1 then
    raise exception 'registered user cannot read active event mentor';
  end if;

  select count(*) into visible_count from public.sponsors;
  if visible_count <> 1 then
    raise exception 'registered user cannot read active event sponsor';
  end if;

  -- The membership term end has to be readable by members and anonymous
  -- visitors, since the marketing calls to action branch on it client-side.
  select count(*) into visible_count from public.app_settings;
  if visible_count <> 1 then
    raise exception 'member cannot read app_settings, saw % rows', visible_count;
  end if;

  -- ...but only admins may move it. This one column ends every membership.
  begin
    update public.app_settings set membership_term_ends_at = now();
    get diagnostics changed_count = row_count;
    if changed_count <> 0 then
      raise exception 'non-admin updated app_settings';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o
update public.user_info
set role_access = 'admin'
where id = :'user_a_id';

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
  changed_count integer;
begin
  select count(*) into visible_count from public.user_info;
  if visible_count <> 2 then
    raise exception 'admin should see all user_info rows, saw %', visible_count;
  end if;

  select count(*) into visible_count from public.event_registrations;
  if visible_count <> 2 then
    raise exception 'admin should see both registrations, saw %', visible_count;
  end if;

  update public.event_registrations
  set status = 'accepted'
  where user_id = current_setting('rls.user_b_id')::uuid;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'admin could not update user B registration';
  end if;

  select count(*) into visible_count
  from public.event_application_responses;
  if visible_count <> 2 then
    raise exception 'admin should see both responses, saw %', visible_count;
  end if;

  select count(*) into visible_count from public.mentors;
  if visible_count <> 1 then
    raise exception 'admin should see mentor catalog';
  end if;

  select count(*) into visible_count from public.sponsors;
  if visible_count <> 1 then
    raise exception 'admin should see sponsor catalog';
  end if;

  update public.app_settings set membership_term_ends_at = now();
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'admin could not set the membership term end';
  end if;
end;
$$;

reset role;

do $$
declare
  anon_purchase_privileges integer;
begin
  select count(*)
  into anon_purchase_privileges
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'purchases'
    and grantee = 'anon';

  if anon_purchase_privileges <> 0 then
    raise exception 'anon still has purchases table privileges';
  end if;
end;
$$;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o
set local role service_role;
update public.user_info
set membership_expires_at = now()
where id = :'user_a_id';
reset role;

rollback;
