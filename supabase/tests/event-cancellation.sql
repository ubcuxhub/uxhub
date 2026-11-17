-- Rollback-only coverage of the unpublish guard and event cancellation
-- (20261117060713): privileges, then the database rules on a fixture event.
reset role;
-- rls.sql switched the guard off for its scheduling fixtures.
set constraints all immediate;
alter table public.events enable trigger guard_event_unpublish;
set constraints all deferred;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- The cancel and count RPCs are service-role only, and the trigger functions
-- are nobody's to call.
do $$
declare
  role_name text;
  fn text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    foreach fn in array array[
      'public.cancel_admin_event(uuid, text, uuid)',
      'public.event_lifecycle_counts(uuid)',
      'public.guard_event_unpublish()',
      'public.guard_canceled_event()',
      'public.guard_canceled_event_check_in()',
      'public.save_admin_event_builder_before_cancellation(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb)'
    ] loop
      if has_function_privilege(role_name, fn, 'execute') then
        raise exception '% can execute %', role_name, fn;
      end if;
    end loop;
  end loop;
  foreach fn in array array[
    'public.cancel_admin_event(uuid, text, uuid)',
    'public.event_lifecycle_counts(uuid)',
    'public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb)'
  ] loop
    if not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'service_role cannot execute %', fn;
    end if;
  end loop;
  -- Browsers never write the cancellation columns directly.
  if has_column_privilege('authenticated', 'public.events', 'canceled_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.events', 'cancellation_note', 'UPDATE') then
    raise exception 'authenticated can write the cancellation columns';
  end if;
end;
$$;

do $$
declare
  v_member uuid;
  v_staff uuid;
  v_event uuid;
  v_ticket uuid;
  v_session uuid;
  v_counts record;
  v_failed boolean;
begin
  insert into public.user_info(email, first_name, last_name, role_access)
    values ('rls-cancel-member@example.test', 'Cancel', 'Member', 'basic') returning id into v_member;
  insert into public.user_info(email, first_name, last_name, role_access)
    values ('rls-cancel-staff@example.test', 'Cancel', 'Staff', 'admin') returning id into v_staff;
  insert into public.events(short_description, starts_at, ends_at, name, description, slug, status, max_capacity, regular_price, member_price)
    values ('Cancel fixture', now() + interval '1 day', now() + interval '2 days', 'RLS cancel fixture',
      'Rollback-only fixture', 'rls-cancel-fixture', 'active', 10, 0, 0) returning id into v_event;

  -- A staff ticket doesn't block a revert; a member's does.
  insert into public.event_tickets(event_id, user_id) values (v_event, v_staff);
  update public.events set status = 'draft' where id = v_event;
  update public.events set status = 'active' where id = v_event;
  insert into public.event_tickets(event_id, user_id) values (v_event, v_member) returning id into v_ticket;
  begin
    update public.events set status = 'draft' where id = v_event;
    v_failed := false;
  exception when others then
    v_failed := sqlerrm = '1 person is registered. Cancel the event instead.';
  end;
  if not v_failed then raise exception 'a member ticket did not block the revert'; end if;

  select * into v_counts from public.event_lifecycle_counts(v_event);
  if v_counts.registered <> 1 or v_counts.paid_tickets <> 0 then
    raise exception 'unexpected lifecycle counts %', row_to_json(v_counts);
  end if;

  perform public.cancel_admin_event(v_event, '  Moved to January.  ', gen_random_uuid());
  if (select cancellation_note from public.events where id = v_event) <> 'Moved to January.' then
    raise exception 'the note was not saved trimmed';
  end if;

  -- Read-only and one-way.
  begin
    update public.events set name = 'Renamed', canceled_at = null where id = v_event;
    v_failed := false;
  exception when others then
    v_failed := sqlstate = 'P0001';
  end;
  if not v_failed then raise exception 'a canceled event accepted an edit'; end if;

  -- No check-ins.
  insert into public.check_in_sessions(event_id, name, start_time, end_time)
    values (v_event, 'Door', now(), now() + interval '1 hour') returning id into v_session;
  begin
    insert into public.check_ins(ticket_id, check_in_session_id, checked_in_at) values (v_ticket, v_session, now());
    v_failed := false;
  exception when others then
    v_failed := sqlerrm = 'This event is canceled.';
  end;
  if not v_failed then raise exception 'a canceled event took a check-in'; end if;
end;
$$;
