\set ON_ERROR_STOP on

begin;

create function pg_temp.expect_error(p_sql text, p_expected text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      if position(p_expected in sqlerrm) = 0 then
        raise exception 'expected error containing "%", got "%" (%).',
          p_expected, sqlerrm, sqlstate;
      end if;
      return;
  end;

  raise exception 'expected error containing "%", but statement succeeded: %',
    p_expected, p_sql;
end;
$$;

select gen_random_uuid() as id
\gset user_a_auth_user_

select gen_random_uuid() as id
\gset user_b_auth_user_

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    :'user_a_auth_user_id',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-user-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    :'user_b_auth_user_id',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-user-b@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.user_info (
  auth_user_id,
  email,
  name,
  role_access
)
values (
  :'user_a_auth_user_id',
  'rls-user-a@example.test',
  'RLS User A',
  'basic'
)
returning id, auth_user_id, email
\gset user_a_

insert into public.user_info (
  auth_user_id,
  email,
  name,
  role_access
)
values (
  :'user_b_auth_user_id',
  'rls-user-b@example.test',
  'RLS User B',
  'basic'
)
returning id, auth_user_id, email
\gset user_b_

insert into public.events (
  name,
  description,
  regular_price,
  member_price,
  max_capacity,
  slug,
  registration_start_time,
  registration_end_time,
  status,
  applications_enabled
)
values (
  'RLS application event',
  'Open application lifecycle test event',
  0,
  0,
  1,
  'rls-application-event',
  now() - interval '1 hour',
  now() + interval '1 hour',
  'active',
  true
)
returning id
\gset event_

insert into public.events (
  name,
  description,
  regular_price,
  member_price,
  max_capacity,
  slug,
  registration_start_time,
  registration_end_time,
  status,
  applications_enabled
)
values (
  'RLS hidden application event',
  'Question visibility and cross-event response fixture',
  0,
  0,
  10,
  'rls-hidden-application-event',
  now() - interval '1 hour',
  now() + interval '1 hour',
  'draft',
  true
)
returning id
\gset hidden_event_

insert into public.event_application_questions (
  event_id,
  question,
  response_type,
  is_required,
  sort_order
)
values (
  :'event_id',
  'Why do you want to attend?',
  'long_text',
  true,
  0
)
returning id
\gset question_

insert into public.event_application_questions (
  event_id,
  question,
  response_type,
  is_required,
  sort_order
)
values (
  :'hidden_event_id',
  'This question must not leak',
  'short_text',
  false,
  0
)
returning id
\gset hidden_question_

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
select set_config('rls.hidden_event_id', :'hidden_event_id', true);
select set_config('rls.hidden_question_id', :'hidden_question_id', true);
select set_config('rls.question_id', :'question_id', true);
select set_config('rls.user_a_id', :'user_a_id', true);
select set_config('rls.user_b_id', :'user_b_id', true);

set local role authenticated;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.user_info;
  if visible_count <> 1 then
    raise exception 'user A should see only their user_info row, saw %',
      visible_count;
  end if;

  select count(*) into visible_count
  from public.event_application_questions;
  if visible_count <> 1 then
    raise exception 'user A should see only the open event question, saw %',
      visible_count;
  end if;

  perform pg_temp.expect_error(
    format(
      'update public.user_info set role_access = ''admin'' where id = %L::uuid',
      current_setting('rls.user_a_id')
    ),
    'permission denied'
  );

  perform pg_temp.expect_error(
    format(
      'select public.submit_event_application(%L::uuid, %L::jsonb)',
      current_setting('rls.event_id'),
      '[]'
    ),
    'REQUIRED_RESPONSE_MISSING'
  );

  if exists (
    select 1
    from public.event_applications
    where user_id = public.current_user_info_id()
  ) then
    raise exception 'failed required-response submit left an application behind';
  end if;

  perform pg_temp.expect_error(
    format(
      'select public.submit_event_application(%L::uuid, jsonb_build_array('
        || 'jsonb_build_object(''question_id'', %L::uuid, ''response'', ''valid''),'
        || 'jsonb_build_object(''question_id'', %L::uuid, ''response'', ''cross event'')))',
      current_setting('rls.event_id'),
      current_setting('rls.question_id'),
      current_setting('rls.hidden_question_id')
    ),
    'INVALID_RESPONSE'
  );

  if exists (
    select 1
    from public.event_applications
    where user_id = public.current_user_info_id()
  ) then
    raise exception 'failed cross-event submit left an application behind';
  end if;
end;
$$;

select public.submit_event_application(
  :'event_id',
  jsonb_build_array(
    jsonb_build_object(
      'question_id', :'question_id'::uuid,
      'response', 'User A response'
    )
  )
) as id
\gset application_a_

select set_config('rls.application_a_id', :'application_a_id', true);

do $$
declare
  application_count integer;
  response_count integer;
begin
  select count(*) into application_count
  from public.event_applications
  where id = current_setting('rls.application_a_id')::uuid;

  select count(*) into response_count
  from public.event_application_responses
  where event_application_id = current_setting('rls.application_a_id')::uuid;

  if application_count <> 1 or response_count <> 1 then
    raise exception
      'atomic submit should create one application and one response, got % and %',
      application_count, response_count;
  end if;

  perform pg_temp.expect_error(
    format(
      'select public.submit_event_application(%L::uuid, jsonb_build_array('
        || 'jsonb_build_object(''question_id'', %L::uuid, ''response'', ''duplicate'')))',
      current_setting('rls.event_id'),
      current_setting('rls.question_id')
    ),
    'event_applications_event_user_key'
  );

  perform pg_temp.expect_error(
    format(
      'insert into public.event_applications (event_id, user_id) '
        || 'values (%L::uuid, %L::uuid)',
      current_setting('rls.event_id'),
      current_setting('rls.user_a_id')
    ),
    'permission denied'
  );

  perform pg_temp.expect_error(
    format(
      'insert into public.event_application_responses '
        || '(event_application_question_id, event_application_id, response) '
        || 'values (%L::uuid, %L::uuid, ''direct'')',
      current_setting('rls.question_id'),
      current_setting('rls.application_a_id')
    ),
    'permission denied'
  );

  perform pg_temp.expect_error(
    format(
      'insert into public.event_registrations (event_id, user_id, application_id) '
        || 'values (%L::uuid, %L::uuid, %L::uuid)',
      current_setting('rls.event_id'),
      current_setting('rls.user_a_id'),
      current_setting('rls.application_a_id')
    ),
    'permission denied'
  );

  perform pg_temp.expect_error(
    format(
      'update public.event_application_responses set response = ''changed'' '
        || 'where event_application_id = %L::uuid',
      current_setting('rls.application_a_id')
    ),
    'permission denied'
  );

  perform pg_temp.expect_error(
    format(
      'delete from public.event_application_responses '
        || 'where event_application_id = %L::uuid',
      current_setting('rls.application_a_id')
    ),
    'permission denied'
  );

  perform pg_temp.expect_error(
    format(
      'select public.review_event_application(%L::uuid, ''accepted'')',
      current_setting('rls.application_a_id')
    ),
    'ADMIN_REQUIRED'
  );
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_b_auth_user_id',
    'email', :'user_b_email',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

select public.submit_event_application(
  :'event_id',
  jsonb_build_array(
    jsonb_build_object(
      'question_id', :'question_id'::uuid,
      'response', 'User B response'
    )
  )
) as id
\gset application_b_

select set_config('rls.application_b_id', :'application_b_id', true);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.event_applications;
  if visible_count <> 1 then
    raise exception 'user B should see only their application, saw %',
      visible_count;
  end if;

  select count(*) into visible_count
  from public.event_application_responses;
  if visible_count <> 1 then
    raise exception 'user B should see only their response, saw %',
      visible_count;
  end if;

  select count(*) into visible_count from public.event_registrations;
  if visible_count <> 0 then
    raise exception 'submitting an application created a registration';
  end if;
end;
$$;

reset role;

update public.events
set registration_end_time = now() - interval '1 minute'
where id = :'event_id';

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_a_auth_user_id',
    'email', :'user_a_email',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.event_applications;
  if visible_count <> 1 then
    raise exception 'user A should see only their application, saw %',
      visible_count;
  end if;

  select count(*) into visible_count
  from public.event_application_responses;
  if visible_count <> 1 then
    raise exception 'user A should see only their response, saw %',
      visible_count;
  end if;

  select count(*) into visible_count
  from public.event_application_questions;
  if visible_count <> 1 then
    raise exception
      'applicant should retain question access after applications close, saw %',
      visible_count;
  end if;
end;
$$;

reset role;

select set_config('request.jwt.claims', '{}', true);

update public.user_info
set role_access = 'admin'
where id = :'user_a_id';

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_a_auth_user_id',
    'email', :'user_a_email',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.user_info;
  if visible_count < 2 then
    raise exception 'admin cannot see both lifecycle test users';
  end if;

  select count(*) into visible_count
  from public.event_applications
  where event_id = current_setting('rls.event_id')::uuid;
  if visible_count <> 2 then
    raise exception 'admin should see both applications, saw %', visible_count;
  end if;

  select count(*) into visible_count
  from public.event_application_responses
  where event_application_id in (
    current_setting('rls.application_a_id')::uuid,
    current_setting('rls.application_b_id')::uuid
  );
  if visible_count <> 2 then
    raise exception 'admin should see both responses, saw %', visible_count;
  end if;

  select count(*) into visible_count
  from public.event_application_questions
  where event_id in (
    current_setting('rls.event_id')::uuid,
    current_setting('rls.hidden_event_id')::uuid
  );
  if visible_count <> 2 then
    raise exception 'admin should see open and hidden questions, saw %',
      visible_count;
  end if;

  perform public.review_event_application(
    current_setting('rls.application_a_id')::uuid,
    'accepted'
  );
  perform public.review_event_application(
    current_setting('rls.application_b_id')::uuid,
    'rejected'
  );
  perform public.review_event_application(
    current_setting('rls.application_b_id')::uuid,
    'accepted'
  );

  if not exists (
    select 1
    from public.event_applications
    where id = current_setting('rls.application_a_id')::uuid
      and status = 'accepted'
      and attendance_status = 'awaiting_confirmation'
      and reviewer_id = public.current_user_info_id()
      and reviewed_at is not null
  ) then
    raise exception 'admin pending-to-accepted review did not persist';
  end if;

  if not exists (
    select 1
    from public.event_applications
    where id = current_setting('rls.application_b_id')::uuid
      and status = 'accepted'
      and attendance_status = 'awaiting_confirmation'
      and reviewer_id = public.current_user_info_id()
      and reviewed_at is not null
  ) then
    raise exception 'admin rejected-to-accepted review did not persist';
  end if;

  perform pg_temp.expect_error(
    format(
      'select public.confirm_free_event_attendance(%L::uuid)',
      current_setting('rls.application_b_id')
    ),
    'APPLICATION_NOT_AWAITING_CONFIRMATION'
  );
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_b_auth_user_id',
    'email', :'user_b_email',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

select public.confirm_free_event_attendance(:'application_b_id') as id
\gset registration_b_

select set_config('rls.registration_b_id', :'registration_b_id', true);

select public.confirm_free_event_attendance(:'application_b_id') as id
\gset registration_b_again_

select set_config(
  'rls.registration_b_again_id',
  :'registration_b_again_id',
  true
);

do $$
begin
  if current_setting('rls.registration_b_id')::uuid
    <> current_setting('rls.registration_b_again_id')::uuid
  then
    raise exception 'owner confirmation was not idempotent';
  end if;

  if not exists (
    select 1
    from public.event_applications
    where id = current_setting('rls.application_b_id')::uuid
      and attendance_status = 'confirmed'
  ) then
    raise exception 'owner confirmation did not mark attendance confirmed';
  end if;

  if (select count(*) from public.event_registrations) <> 1 then
    raise exception 'owner should see exactly their confirmed registration';
  end if;
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_a_auth_user_id',
    'email', :'user_a_email',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
begin
  perform pg_temp.expect_error(
    format(
      'select public.confirm_free_event_attendance(%L::uuid)',
      current_setting('rls.application_a_id')
    ),
    'SOLD_OUT'
  );
end;
$$;

reset role;

update public.user_info
set role_access = 'basic'
where id = :'user_a_id';

set local role authenticated;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.event_registrations;
  if visible_count <> 0 then
    raise exception 'user A can read user B registration';
  end if;
end;
$$;

reset role;

select set_config('request.jwt.claims', '{}', true);

update public.user_info
set role_access = 'admin'
where id = :'user_a_id';

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'user_a_auth_user_id',
    'email', :'user_a_email',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.event_registrations
  where id = current_setting('rls.registration_b_id')::uuid;
  if visible_count <> 1 then
    raise exception 'admin cannot read user B registration';
  end if;

  perform public.mark_event_application_not_attending(
    current_setting('rls.application_b_id')::uuid
  );

  if exists (
    select 1
    from public.event_registrations
    where id = current_setting('rls.registration_b_id')::uuid
  ) then
    raise exception 'mark not attending did not delete the registration';
  end if;

  if not exists (
    select 1
    from public.event_applications
    where id = current_setting('rls.application_b_id')::uuid
      and attendance_status = 'not_attending'
  ) then
    raise exception 'mark not attending did not update the application';
  end if;
end;
$$;

select public.confirm_free_event_attendance(:'application_a_id') as id
\gset registration_a_

select set_config('rls.registration_a_id', :'registration_a_id', true);

reset role;

insert into public.check_in_sessions (
  event_id,
  name,
  start_time,
  end_time
)
values (
  :'event_id',
  'RLS attendance session',
  now(),
  now() + interval '1 hour'
)
returning id
\gset session_

insert into public.check_ins (
  event_registration_id,
  check_in_session_id
)
values (
  :'registration_a_id',
  :'session_id'
);

set local role authenticated;

do $$
begin
  perform pg_temp.expect_error(
    format(
      'select public.mark_event_application_not_attending(%L::uuid)',
      current_setting('rls.application_a_id')
    ),
    'REGISTRATION_HAS_CHECK_INS'
  );

  if not exists (
    select 1
    from public.event_registrations
    where id = current_setting('rls.registration_a_id')::uuid
  ) then
    raise exception 'failed check-in-protected removal deleted registration';
  end if;

  if not exists (
    select 1
    from public.event_applications
    where id = current_setting('rls.application_a_id')::uuid
      and attendance_status = 'confirmed'
  ) then
    raise exception 'failed check-in-protected removal changed attendance';
  end if;
end;
$$;

reset role;

select set_config('request.jwt.claims', '{}', true);

set local role service_role;

update public.user_info
set membership_expires_at = now()
where id = :'user_a_id';

reset role;

rollback;
