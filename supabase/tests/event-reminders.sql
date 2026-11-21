-- Event reminders (supabase/README.md, "Event reminder emails"): browser roles
-- reach neither the send table nor the functions, nothing is due while an
-- event's reminders are off, and the cron job calls only the URL stored in
-- Vault, signed with the application emails secret over its own message.
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
  'rls-reminder-member@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
)
returning id as auth_user_id
\gset reminder_member_

insert into public.user_info (auth_user_id, email, first_name, last_name, role_access)
values (:'reminder_member_auth_user_id', 'rls-reminder-member@example.test', 'Reminder', 'Member', 'basic')
returning id \gset reminder_member_

insert into public.events (
  short_description, starts_at, ends_at,
  name, description, regular_price, member_price, max_capacity, slug, status
)
values (
  'RLS reminders', now() + interval '20 hours', now() + interval '22 hours', 'RLS Reminders',
  'RLS event reminders', 0, 0, 10, 'rls-event-reminders', 'draft'
)
returning id \gset reminder_event_

update public.events set status = 'active' where id = :'reminder_event_id';

insert into public.event_tickets (event_id, user_id, created_at)
values (:'reminder_event_id', :'reminder_member_id', now() - interval '2 days')
returning id \gset reminder_ticket_

select set_config('rls.reminder_event_id', :'reminder_event_id', true);
select set_config('rls.reminder_ticket_id', :'reminder_ticket_id', true);

-- Browser roles: no schema, no table, no functions.
select set_config('request.jwt.claims', json_build_object('sub', :'reminder_member_auth_user_id', 'role', 'authenticated')::text, true);
do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if has_schema_privilege(v_role, 'event_reminders', 'usage') then
      raise exception '% can use the event_reminders schema', v_role;
    end if;
    if has_table_privilege(v_role, 'event_reminders.sends', 'select, insert, update, delete') then
      raise exception '% can reach event reminder sends', v_role;
    end if;
    if has_function_privilege(v_role, 'public.claim_event_reminders(integer, uuid[])', 'execute')
       or has_function_privilege(v_role, 'public.complete_event_reminder(uuid, boolean, text)', 'execute')
       or has_function_privilege(v_role, 'public.release_event_reminders(uuid[], text)', 'execute') then
      raise exception '% can claim or complete event reminders', v_role;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.claim_event_reminders(integer, uuid[])', 'execute') then
    raise exception 'the service role cannot claim event reminders';
  end if;
  if has_schema_privilege('service_role', 'event_reminders', 'usage') then
    raise exception 'the service role can use the event_reminders schema directly';
  end if;
end $$;

set local role authenticated;
do $$ begin
  perform public.claim_event_reminders(25, null);
  raise exception 'a member claimed event reminders';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from event_reminders.sends;
  raise exception 'a member read event reminder sends';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.events set reminder_schedule = 'both'
  where id = current_setting('rls.reminder_event_id')::uuid;
  if found then raise exception 'a member changed an event''s reminders'; end if;
exception when insufficient_privilege then null;
end $$;
reset role;
set local role anon;
do $$ begin
  perform public.release_event_reminders(array[gen_random_uuid()], null);
  raise exception 'a visitor released event reminders';
exception when insufficient_privilege then null;
end $$;
reset role;

\o /dev/null
select set_config('request.jwt.claims', '{}', true);
\o

-- Off by default: nothing is due until the event's admins choose a reminder.
do $$
declare
  v_event uuid := current_setting('rls.reminder_event_id')::uuid;
begin
  if (select reminder_schedule from public.events where id = v_event) <> 'off' then
    raise exception 'a new event row does not default to off';
  end if;
  if exists (select 1 from event_reminders.due_work(array[v_event])) then
    raise exception 'a reminder is due while reminders are off';
  end if;
  begin
    update public.events set reminder_schedule = 'weekly' where id = v_event;
    raise exception 'an unknown reminder schedule was stored';
  exception when check_violation then null;
  end;
  update public.events set reminder_schedule = '1d' where id = v_event;
  if (select count(*) from event_reminders.due_work(array[v_event])) <> 1 then
    raise exception 'the day-before reminder is not due';
  end if;
end $$;

-- The job: nothing without both Vault secrets, then one signed POST to the
-- stored URL.
do $$
declare
  v_before bigint;
  v_request record;
  v_signed_at text;
  v_secret text;
begin
  select coalesce(max(id), 0) into v_before from net.http_request_queue;
  if exists (select 1 from vault.decrypted_secrets where name = 'event_reminders_url') then
    raise notice 'skipping the unconfigured check: this database has an event reminders URL';
    return;
  end if;

  -- No URL: nothing, even with the secret.
  if not exists (select 1 from vault.decrypted_secrets where name = 'application_emails_secret') then
    perform vault.create_secret('rls-reminder-secret', 'application_emails_secret');
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'application_emails_secret';
  perform event_reminders.dispatch();
  if exists (select 1 from net.http_request_queue where id > v_before) then
    raise exception 'the job called out without its URL';
  end if;

  perform vault.create_secret('https://reminders.example.test/api/internal/event-reminders', 'event_reminders_url');
  perform event_reminders.dispatch();
  select * into v_request from net.http_request_queue where id > v_before;
  if not found or v_request.url <> 'https://reminders.example.test/api/internal/event-reminders'
     or v_request.method <> 'POST' then
    raise exception 'the job did not POST to the stored URL';
  end if;
  v_signed_at := v_request.headers ->> 'x-event-reminders-timestamp';
  if v_request.headers ->> 'x-event-reminders-signature' is distinct from
     encode(extensions.hmac('event-reminders:' || v_signed_at, v_secret, 'sha256'), 'hex') then
    raise exception 'the job signed the request wrongly';
  end if;
  if v_request.headers::text like '%' || v_secret || '%' then
    raise exception 'the job put the secret in the request';
  end if;
end $$;

-- Claimed once, sent once; a voided ticket takes its rows with it.
do $$
declare
  v_event uuid := current_setting('rls.reminder_event_id')::uuid;
  v_ticket uuid := current_setting('rls.reminder_ticket_id')::uuid;
  v_claim record;
begin
  select * into v_claim from public.claim_event_reminders(25, array[v_event]);
  if v_claim.ticket_id is distinct from v_ticket or v_claim.kind <> '1d' then
    raise exception 'the reminder was not claimed: %', row_to_json(v_claim);
  end if;
  perform public.complete_event_reminder(v_claim.send_id, true, null);
  update public.events set reminder_schedule = 'both' where id = v_event;
  if exists (select 1 from public.claim_event_reminders(25, array[v_event])) then
    raise exception 'a sent reminder was claimed again';
  end if;

  if public.void_event_ticket(v_ticket) is not null then
    raise exception 'the free ticket could not be voided';
  end if;
  if exists (select 1 from event_reminders.sends where ticket_id = v_ticket) then
    raise exception 'a voided ticket kept its reminder rows';
  end if;
end $$;
