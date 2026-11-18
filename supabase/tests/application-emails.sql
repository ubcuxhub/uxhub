-- Application emails (supabase/README.md, "Application emails"): browser roles
-- reach neither the delivery table nor the functions, the backfill marks what
-- is due as sent, and the cron job calls only the URL stored in Vault, signed.
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
  'rls-email-member@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
)
returning id as auth_user_id
\gset email_member_

insert into public.user_info (auth_user_id, email, first_name, last_name, role_access)
values (:'email_member_auth_user_id', 'rls-email-member@example.test', 'Email', 'Member', 'basic')
returning id \gset email_member_

insert into public.events (
  short_description, starts_at, ends_at,
  name, description, regular_price, member_price, max_capacity, slug,
  registration_opens_at, registration_closes_at, status, requires_application
)
values (
  'RLS emails', now() + interval '5 days', now() + interval '6 days', 'RLS Emails',
  'RLS application emails', 0, 0, 10, 'rls-application-emails',
  now() - interval '2 days', now() - interval '1 hour', 'draft', true
)
returning id \gset email_event_

insert into public.event_application_questions (event_id, question, response_type)
values (:'email_event_id', 'Why?', 'long_text');
update public.events set status = 'active' where id = :'email_event_id';

insert into public.event_application_settings (event_id, decisions_release_at)
values (:'email_event_id', now() - interval '1 hour');

insert into public.event_applications (event_id, user_id, status, offer_expires_at)
values (:'email_event_id', :'email_member_id', 'accepted', now() + interval '12 hours')
returning id \gset email_application_

select set_config('rls.email_event_id', :'email_event_id', true);
select set_config('rls.email_application_id', :'email_application_id', true);

-- Browser roles: no schema, no table, no functions.
select set_config('request.jwt.claims', json_build_object('sub', :'email_member_auth_user_id', 'role', 'authenticated')::text, true);
do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if has_schema_privilege(v_role, 'application_emails', 'usage') then
      raise exception '% can use the application_emails schema', v_role;
    end if;
    if has_table_privilege(v_role, 'application_emails.deliveries', 'select, insert, update, delete') then
      raise exception '% can reach application email deliveries', v_role;
    end if;
    if has_function_privilege(v_role, 'public.claim_application_emails(integer, uuid[])', 'execute')
       or has_function_privilege(v_role, 'public.complete_application_email(uuid, boolean, text)', 'execute')
       or has_function_privilege(v_role, 'public.release_application_emails(uuid[], text)', 'execute') then
      raise exception '% can claim or complete application emails', v_role;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.claim_application_emails(integer, uuid[])', 'execute') then
    raise exception 'the service role cannot claim application emails';
  end if;
  if has_schema_privilege('service_role', 'application_emails', 'usage') then
    raise exception 'the service role can use the application_emails schema directly';
  end if;
end $$;

set local role authenticated;
do $$ begin
  perform public.claim_application_emails(25, null);
  raise exception 'a member claimed application emails';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from application_emails.deliveries;
  raise exception 'a member read application email deliveries';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role anon;
do $$ begin
  perform public.complete_application_email(gen_random_uuid(), true, null);
  raise exception 'a visitor completed an application email';
exception when insufficient_privilege then null;
end $$;
reset role;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o

-- The backfill marks the released decision and the due reminder as sent, so
-- nothing is left to claim.
do $$
declare
  v_event uuid := current_setting('rls.email_event_id')::uuid;
  v_marked integer;
begin
  if (select count(*) from application_emails.due_work(array[v_event])) <> 1 then
    raise exception 'the released acceptance is not due';
  end if;
  v_marked := application_emails.backfill(array[v_event]);
  if v_marked <> 2 then
    raise exception 'the backfill marked % emails, expected the acceptance and its reminder', v_marked;
  end if;
  if exists (select 1 from application_emails.deliveries
             where application_id = current_setting('rls.email_application_id')::uuid
               and (sent_at is null or last_error_code <> 'BACKFILL')) then
    raise exception 'a backfilled email is not marked sent';
  end if;
  if exists (select 1 from public.claim_application_emails(25, array[v_event])) then
    raise exception 'a backfilled email was claimed';
  end if;
end $$;

-- The job: nothing without both Vault secrets, then one signed POST to the
-- stored URL.
do $$
declare
  v_event uuid := current_setting('rls.email_event_id')::uuid;
  v_before bigint;
  v_request record;
  v_signed_at text;
begin
  -- Something due, so only the missing configuration stops the job.
  update public.event_applications set status = 'rejected', offer_expires_at = null
  where id = current_setting('rls.email_application_id')::uuid;
  if not exists (select 1 from application_emails.due_work(array[v_event])) then
    raise exception 'the changed decision is not due';
  end if;

  select coalesce(max(id), 0) into v_before from net.http_request_queue;
  if exists (select 1 from vault.decrypted_secrets
             where name in ('application_emails_url', 'application_emails_secret')) then
    raise notice 'skipping the unconfigured check: this database has application email secrets';
  else
    perform application_emails.dispatch();
    if exists (select 1 from net.http_request_queue where id > v_before) then
      raise exception 'the job called out without its Vault secrets';
    end if;
    perform vault.create_secret('https://emails.example.test/api/internal/application-emails', 'application_emails_url');
    perform application_emails.dispatch();
    if exists (select 1 from net.http_request_queue where id > v_before) then
      raise exception 'the job called out with only the URL';
    end if;
    perform vault.create_secret('rls-test-secret', 'application_emails_secret');
    perform application_emails.dispatch();
    select * into v_request from net.http_request_queue where id > v_before;
    if not found or v_request.url <> 'https://emails.example.test/api/internal/application-emails'
       or v_request.method <> 'POST' then
      raise exception 'the job did not POST to the stored URL';
    end if;
    v_signed_at := v_request.headers ->> 'x-application-emails-timestamp';
    if v_request.headers ->> 'x-application-emails-signature' is distinct from
       encode(extensions.hmac('application-emails:' || v_signed_at, 'rls-test-secret', 'sha256'), 'hex') then
      raise exception 'the job signed the request wrongly';
    end if;
    if v_request.headers::text like '%rls-test-secret%' then
      raise exception 'the job put the secret in the request';
    end if;
  end if;
end $$;

-- Reminders: a day before the deadline, once the acceptance went out before
-- that day began; a moved deadline reminds again.
insert into public.user_info (email, first_name, last_name, role_access)
values ('rls-email-reminded@example.test', 'Email', 'Reminded', 'basic')
returning id \gset email_reminded_

insert into public.event_applications (event_id, user_id, status, offer_expires_at)
values (:'email_event_id', :'email_reminded_id', 'accepted', now() + interval '12 hours')
returning id \gset email_reminded_application_

select set_config('rls.email_reminded_application_id', :'email_reminded_application_id', true);
select set_config('rls.email_reminded_id', :'email_reminded_id', true);

do $$
declare
  v_event uuid := current_setting('rls.email_event_id')::uuid;
  v_application uuid := current_setting('rls.email_reminded_application_id')::uuid;
  v_claim record;
begin
  -- The acceptance went out an hour ago, inside the last day: it named the
  -- deadline, so no reminder.
  insert into application_emails.deliveries (application_id, kind, key, sent_at, attempts)
  values (v_application, 'accepted', 'accepted', now() - interval '1 hour', 1);
  if exists (select 1 from application_emails.due_work(array[v_event]) where application_id = v_application) then
    raise exception 'a reminder is due right after the acceptance';
  end if;

  -- Sent two days ago: the reminder is due, and claimed once.
  update application_emails.deliveries set sent_at = now() - interval '2 days'
  where application_id = v_application and kind = 'accepted';
  select * into v_claim from public.claim_application_emails(25, array[v_event]) c
  where c.application_id = v_application;
  if v_claim.kind is distinct from 'offer_reminder' then
    raise exception 'the reminder was not claimed: %', row_to_json(v_claim);
  end if;
  perform public.complete_application_email(v_claim.delivery_id, true, null);
  if exists (select 1 from public.claim_application_emails(25, array[v_event]) c
             where c.application_id = v_application) then
    raise exception 'a sent reminder was claimed again';
  end if;

  -- A new deadline is a new reminder.
  update public.event_applications set offer_expires_at = now() + interval '20 hours'
  where id = v_application;
  select * into v_claim from public.claim_application_emails(25, array[v_event]) c
  where c.application_id = v_application;
  if v_claim.kind is distinct from 'offer_reminder' then
    raise exception 'a moved deadline was not reminded';
  end if;
  perform public.complete_application_email(v_claim.delivery_id, true, null);

  -- Registered: no reminder, whatever the deadline.
  update public.event_applications set offer_expires_at = now() + interval '22 hours'
  where id = v_application;
  if not exists (select 1 from application_emails.due_work(array[v_event]) where application_id = v_application) then
    raise exception 'the third deadline was not due';
  end if;
  insert into public.event_tickets (event_id, user_id)
  values (v_event, current_setting('rls.email_reminded_id')::uuid);
  if exists (select 1 from application_emails.due_work(array[v_event]) where application_id = v_application) then
    raise exception 'a registered applicant is due a reminder';
  end if;
end $$;
