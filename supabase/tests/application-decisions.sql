-- Decision release (docs/event-states.md, "Decision release"): before
-- "Release decisions on" an applicant can't select their decided row and
-- get_my_event_applications reports it as submitted; afterwards both show the
-- decision. Admins always see it, and reservation refuses before release.
reset role;
\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  gen_random_uuid(), 'authenticated', 'authenticated',
  'rls-decide-member@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
)
returning id as auth_user_id
\gset decide_member_

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  gen_random_uuid(), 'authenticated', 'authenticated',
  'rls-decide-admin@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
)
returning id as auth_user_id
\gset decide_admin_

insert into public.user_info (auth_user_id, email, first_name, last_name, role_access)
values (:'decide_member_auth_user_id', 'rls-decide-member@example.test', 'Decide', 'Member', 'basic')
returning id \gset decide_member_

insert into public.user_info (auth_user_id, email, first_name, last_name, role_access)
values (:'decide_admin_auth_user_id', 'rls-decide-admin@example.test', 'Decide', 'Admin', 'admin')
returning id \gset decide_admin_

insert into public.user_info (email, first_name, last_name, role_access)
values ('rls-decide-other@example.test', 'Decide', 'Other', 'basic')
returning id \gset decide_other_

insert into public.events (
  short_description, starts_at, ends_at,
  name, description, regular_price, member_price, max_capacity, slug,
  registration_opens_at, registration_closes_at, status, requires_application
)
values (
  'RLS decisions', now() + interval '5 days', now() + interval '6 days', 'RLS Decisions',
  'RLS decision release', 0, 0, 10, 'rls-decisions',
  now() - interval '2 days', now() - interval '1 hour', 'draft', true
)
returning id \gset decide_event_

insert into public.event_application_questions (event_id, question, response_type)
values (:'decide_event_id', 'Why?', 'long_text')
returning id \gset decide_question_

-- Published once it has a question (guard_event_publication_questions).
update public.events set status = 'active' where id = :'decide_event_id';

insert into public.event_application_settings (event_id, decisions_release_at, confirmation_deadline)
values (:'decide_event_id', now() + interval '1 day', now() + interval '2 days');

insert into public.event_applications (event_id, user_id, status, offer_expires_at)
values (:'decide_event_id', :'decide_member_id', 'accepted', now() + interval '3 days')
returning id \gset decide_application_

insert into public.event_application_responses (application_id, event_application_question_id, response)
values (:'decide_application_id', :'decide_question_id', 'Decide response');

insert into public.event_applications (event_id, user_id, status)
values (:'decide_event_id', :'decide_other_id', 'rejected')
returning id \gset decide_other_application_

select set_config('rls.decide_event_id', :'decide_event_id', true);
select set_config('rls.decide_member_id', :'decide_member_id', true);
select set_config('rls.decide_application_id', :'decide_application_id', true);
select set_config('rls.decide_other_application_id', :'decide_other_application_id', true);

-- Before release: the applicant sees "submitted" through the function and
-- nothing through a direct select, but still reads their own answers.
select set_config('request.jwt.claims', json_build_object('sub', :'decide_member_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  v_row record;
begin
  if exists (select 1 from public.event_applications where id = current_setting('rls.decide_application_id')::uuid) then
    raise exception 'applicant can select a decision before release';
  end if;
  select * into v_row from public.get_my_event_applications(array[current_setting('rls.decide_event_id')::uuid]);
  if v_row.status is distinct from 'submitted' or v_row.offer_expires_at is not null
     or v_row.updated_at is not null or v_row.decisions_release_at is null then
    raise exception 'get_my_event_applications leaked a decision before release: %', row_to_json(v_row);
  end if;
  if (select count(*) from public.event_application_responses
      where application_id = current_setting('rls.decide_application_id')::uuid) <> 1 then
    raise exception 'applicant cannot read their own answers before release';
  end if;
  if has_function_privilege('authenticated', 'public.decide_event_application(uuid, text, timestamptz, boolean)', 'execute') then
    raise exception 'browser roles can decide applications';
  end if;
end $$;
reset role;

-- Admins see the decision whatever the release.
select set_config('request.jwt.claims', json_build_object('sub', :'decide_admin_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select status from public.event_applications where id = current_setting('rls.decide_application_id')::uuid) is distinct from 'accepted' then
    raise exception 'admin cannot see a decision before release';
  end if;
end $$;
reset role;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o

-- Before release: no ticket, decisions move freely, deadlines follow the release.
do $$
declare
  v_reservation record;
  v_decision record;
  v_event uuid := current_setting('rls.decide_event_id')::uuid;
  v_application uuid := current_setting('rls.decide_application_id')::uuid;
begin
  select * into v_reservation from public.reserve_event_ticket(v_event, current_setting('rls.decide_member_id')::uuid);
  if v_reservation.failure_reason is distinct from 'APPLICATION_REQUIRED' then
    raise exception 'reservation before release returned %', v_reservation.failure_reason;
  end if;

  select * into v_decision from public.decide_event_application(v_application, 'waitlist');
  if v_decision.failure_reason is not null or v_decision.status <> 'waitlisted' then
    raise exception 'an unreleased offer could not move to the waitlist: %', row_to_json(v_decision);
  end if;
  select * into v_decision from public.decide_event_application(current_setting('rls.decide_other_application_id')::uuid, 'waitlist');
  if v_decision.failure_reason is not null then
    raise exception 'an unreleased rejection could not change: %', v_decision.failure_reason;
  end if;
  update public.event_applications set status = 'rejected' where id = current_setting('rls.decide_other_application_id')::uuid;

  select * into v_decision from public.decide_event_application(v_application, 'accept', now() + interval '12 hours');
  if v_decision.failure_reason is distinct from 'DEADLINE_TOO_EARLY' then
    raise exception 'an offer ending before release was accepted: %', v_decision.failure_reason;
  end if;
  select * into v_decision from public.decide_event_application(v_application, 'accept', now() + interval '3 days');
  if v_decision.failure_reason is not null or v_decision.status <> 'accepted' then
    raise exception 'accepting before release failed: %', v_decision.failure_reason;
  end if;
end $$;

-- Release.
update public.event_application_settings
set decisions_release_at = now() - interval '1 minute'
where event_id = :'decide_event_id';

select set_config('request.jwt.claims', json_build_object('sub', :'decide_member_auth_user_id', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  v_row record;
begin
  if (select status from public.event_applications where id = current_setting('rls.decide_application_id')::uuid) is distinct from 'accepted' then
    raise exception 'applicant cannot select their decision after release';
  end if;
  select * into v_row from public.get_my_event_applications(array[current_setting('rls.decide_event_id')::uuid]);
  if v_row.status is distinct from 'accepted' or v_row.offer_expires_at is null or v_row.updated_at is null then
    raise exception 'get_my_event_applications hid a released decision: %', row_to_json(v_row);
  end if;
end $$;
reset role;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o

-- After release: reservation works, the old moves apply, and the release
-- can't move back into the future.
do $$
declare
  v_reservation record;
  v_decision record;
  v_hint text;
begin
  select * into v_reservation from public.reserve_event_ticket(
    current_setting('rls.decide_event_id')::uuid, current_setting('rls.decide_member_id')::uuid);
  if v_reservation.ticket_id is null then
    raise exception 'reservation after release failed: %', v_reservation.failure_reason;
  end if;

  select * into v_decision from public.decide_event_application(current_setting('rls.decide_application_id')::uuid, 'waitlist');
  if v_decision.failure_reason is distinct from 'HAS_TICKET' then
    raise exception 'a registered offer changed: %', v_decision.failure_reason;
  end if;
  select * into v_decision from public.decide_event_application(
    current_setting('rls.decide_other_application_id')::uuid, 'accept', now() + interval '3 days');
  if v_decision.failure_reason is distinct from 'NOT_ALLOWED' then
    raise exception 'a released rejection changed: %', v_decision.failure_reason;
  end if;

  begin
    update public.event_application_settings
    set decisions_release_at = now() + interval '1 day'
    where event_id = current_setting('rls.decide_event_id')::uuid;
    raise exception 'a passed release moved into the future';
  exception when raise_exception then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint is distinct from 'EVENT_SETTINGS_CONFLICT' then raise; end if;
  end;
end $$;
