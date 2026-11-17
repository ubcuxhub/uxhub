-- Guard unpublishing and add event cancellation (docs/event-states.md,
-- "Unpublishing" and "Canceled events").
--
-- 1. Active -> Draft is refused while a member is registered, through every
--    write path: one trigger on events that only refuses.
-- 2. Cancel: a one-way flag on an active event that hasn't ended
--    (`cancel_admin_event`). Nothing is rewritten: tickets, purchases,
--    applications and teams stay, and ticket holders keep seeing the event.
--    A canceled event is read-only except its links and resources, takes no
--    applications or team changes, and refuses check-in. Checkout and
--    reservation already refuse it (EVENT_CANCELED, 20261117054623).
-- 3. A read-only count for the admin dialogs (`event_lifecycle_counts`).
--
-- Backward compatible with the deployed code: no event is canceled until this
-- release's action runs, and every redefined function keeps its signature.

-- 1. Unpublishing --------------------------------------------------------------

-- Members registered for an event (a ticket, a held offer or a payment in
-- flight; event_member_commitments) would lose their page and QR code if it
-- went back to Draft, since RLS hides drafts. Staff test tickets don't count.
-- Volatile helpers, so a check made after waiting on the row lock sees rows
-- committed meanwhile.
create function public.guard_event_unpublish()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_registered integer;
begin
  select c.tickets + c.offers + c.pending_purchases into v_registered
  from public.event_member_commitments(old.id) c;
  if v_registered > 0 then
    raise exception '% % registered. Cancel the event instead.',
      v_registered, case when v_registered = 1 then 'person is' else 'people are' end
      using hint = 'EVENT_SETTINGS_CONFLICT';
  end if;
  return new;
end $$;

create trigger guard_event_unpublish before update on public.events
for each row when (old.status = 'active' and new.status = 'draft')
execute function public.guard_event_unpublish();

-- 2. Canceled events are read-only --------------------------------------------

-- Like the ended-event lock (zz_event_history_and_revision), but it holds for
-- every writer, the service role included: cancellation can't be undone, and
-- the guarded builder actions run as the service role. Only `revision` (bumped
-- by save_past_event_resources) and `updated_at` may change. Sorts before
-- zz_event_history_and_revision, which then bumps the revision.
create function public.guard_canceled_event()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.canceled_at is not null then
    if (to_jsonb(new) - 'revision' - 'updated_at') is distinct from (to_jsonb(old) - 'revision' - 'updated_at') then
      raise exception 'This event is canceled. Only links and resources can be updated.'
        using hint = 'EVENT_HISTORY_LOCKED';
    end if;
  elsif new.canceled_at is not null and new.status <> 'active' then
    raise exception 'Only a published event can be canceled.' using hint = 'EVENT_CANCEL_REFUSED';
  end if;
  return new;
end $$;

create trigger zz_event_canceled_lock before update on public.events
for each row when (old.canceled_at is not null or new.canceled_at is distinct from old.canceled_at)
execute function public.guard_canceled_event();

-- Child settings follow the event (as 20261112231350's ended-event lock):
-- browsers can't change a canceled event's sessions, questions, people or
-- dates. The service role keeps its maintenance capability here; its builder
-- path is refused by save_admin_event_builder below.
create or replace function public.guard_historical_event_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare eid uuid; e public.events;
begin
 if auth.role() = 'service_role' then return coalesce(new,old); end if;
 if tg_op <> 'INSERT' then
  eid := old.event_id;
  select * into e from public.events where id=eid for update;
  if found and public.event_has_ended(e) then raise exception 'Historical event details are locked.' using hint='EVENT_HISTORY_LOCKED'; end if;
  if found and e.canceled_at is not null then raise exception 'This event is canceled. Only links and resources can be updated.' using hint='EVENT_HISTORY_LOCKED'; end if;
 end if;
 if tg_op <> 'DELETE' then
  eid := new.event_id;
  select * into e from public.events where id=eid for update;
  if found and public.event_has_ended(e) then raise exception 'Historical event details are locked.' using hint='EVENT_HISTORY_LOCKED'; end if;
  if found and e.canceled_at is not null then raise exception 'This event is canceled. Only links and resources can be updated.' using hint='EVENT_HISTORY_LOCKED'; end if;
 end if;
 return coalesce(new,old);
end $$;

-- The builder refuses a canceled event before it writes anything, so a save
-- that only touches child rows can't slip past the events trigger. A retry of
-- a save that committed before the cancel still gets its receipt.
alter function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb)
  rename to save_admin_event_builder_before_cancellation;
create function public.save_admin_event_builder(
  p_event_id uuid, p_draft_id uuid, p_draft_revision integer, p_event jsonb, p_slug text,
  p_expected_image_url text, p_expected_header_image_url text, p_check_in_sessions jsonb,
  p_application_questions jsonb, p_mentors jsonb, p_sponsors jsonb
) returns jsonb
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20270101,13);
  if not exists (select 1 from public.admin_event_mutations where id = (p_event->>'_operation_id')::uuid)
     and exists (
       select 1 from public.events
       where canceled_at is not null
         and (id = p_event_id or id = p_draft_id or p_draft_id = any(legacy_draft_ids))
     ) then
    raise exception 'This event is canceled. Only links and resources can be updated.' using hint = 'EVENT_HISTORY_LOCKED';
  end if;
  return public.save_admin_event_builder_before_cancellation(
    p_event_id, p_draft_id, p_draft_revision, p_event, p_slug, p_expected_image_url,
    p_expected_header_image_url, p_check_in_sessions, p_application_questions, p_mentors, p_sponsors);
end $$;
revoke all on function public.save_admin_event_builder_before_cancellation(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_admin_event_builder(uuid, uuid, integer, jsonb, text, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

-- Links and resources stay editable on a canceled event, as on an ended one
-- (20261112231350); the only change is the canceled condition.
create or replace function public.save_past_event_resources(p_event_id uuid,p_revision integer,p_links jsonb,p_operation_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare e public.events; d jsonb; rev integer; r jsonb; req jsonb; receipt public.admin_event_mutations;
begin
 perform pg_catalog.pg_advisory_xact_lock(20270101,13);
 req := jsonb_build_object('event_id',p_event_id,'revision',p_revision,'links',p_links,'kind','resources');
 select * into receipt from public.admin_event_mutations where id=p_operation_id;
 if found then
  if receipt.request <> req then raise exception 'This retry differs from the original request.' using hint='EVENT_REVISION_CONFLICT'; end if;
  return receipt.result;
 end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'This event no longer exists.' using hint='EVENT_REVISION_CONFLICT'; end if;
 if e.revision <> p_revision then raise exception 'This event changed in another tab. Reload before saving; your edits are still here.' using hint='EVENT_REVISION_CONFLICT'; end if;
 if not public.event_has_ended(e) and e.canceled_at is null then raise exception 'This event has not ended. Reload before saving.' using hint='EVENT_HISTORY_LOCKED'; end if;
 perform public.validate_event_content(jsonb_build_object('revision',0,'sections','[]'::jsonb,'links',p_links));
 if exists(select 1 from jsonb_array_elements(p_links) l join public.event_links el on el.id=(l->>'id')::uuid where el.event_id<>p_event_id) then
  raise exception 'Resource belongs to another event.' using hint='EVENT_CONTENT_INVALID';
 end if;
 select document,revision into d,rev from public.event_content_settings where event_id=p_event_id;
 delete from public.event_links where event_id=p_event_id;
 insert into public.event_links(id,event_id,type,label,url,visibility,sort_order)
 select (value->>'id')::uuid,p_event_id,(value->>'type')::public.event_link_type,nullif(btrim(value->>'label'),''),value->>'url',(value->>'visibility')::public.event_link_visibility,ordinality-1
 from jsonb_array_elements(p_links) with ordinality;
 if d is not null then
  d := d || jsonb_build_object('links',p_links,'revision',rev+1);
  update public.event_content_settings set document=d,revision=rev+1 where event_id=p_event_id;
 end if;
 update public.events set revision=revision+1 where id=p_event_id returning * into e;
 r := jsonb_build_object('id',e.id,'revision',e.revision,'content',d);
 insert into public.admin_event_mutations(id,request,result) values(p_operation_id,req,r);
 return r;
end $$;

-- 3. Cancelling ---------------------------------------------------------------

-- Staff only, through a server action that has run requireAdmin(). Takes the
-- builder's lock and keeps a receipt, as delete_admin_event_safely does, so a
-- lost response can be retried. Works only on an active event that hasn't
-- ended and isn't canceled; sets `canceled_at` and the optional note, and
-- nothing else. Returns the saved event row.
create function public.cancel_admin_event(p_event_id uuid, p_note text, p_operation_id uuid)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  e public.events;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  req jsonb;
  receipt public.admin_event_mutations;
  r jsonb;
begin
  if auth.role() is distinct from 'service_role' and not coalesce(public.is_admin(), false) then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if p_operation_id is null then raise exception 'An operation id is required.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(20270101,13);
  req := jsonb_build_object('kind','cancel','event_id',p_event_id,'note',v_note);
  select * into receipt from public.admin_event_mutations where id = p_operation_id;
  if found then
    if receipt.request <> req then
      raise exception 'This retry differs from the original request.' using hint = 'EVENT_REVISION_CONFLICT';
    end if;
    return receipt.result;
  end if;

  select * into e from public.events where id = p_event_id for update;
  if not found then raise exception 'This event no longer exists.' using hint = 'EVENT_CANCEL_REFUSED'; end if;
  if e.canceled_at is not null then
    raise exception 'This event is already canceled.' using hint = 'EVENT_CANCEL_REFUSED';
  end if;
  if e.status <> 'active' then
    raise exception 'Only a published event can be canceled. Delete a draft instead.' using hint = 'EVENT_CANCEL_REFUSED';
  end if;
  if public.event_has_ended(e) then
    raise exception 'This event has ended, so it can’t be canceled.' using hint = 'EVENT_CANCEL_REFUSED';
  end if;
  if char_length(v_note) > 1000 then
    raise exception 'Keep the note to 1,000 characters.' using hint = 'EVENT_CANCEL_REFUSED';
  end if;

  update public.events set canceled_at = now(), cancellation_note = v_note
  where id = p_event_id returning * into e;
  r := to_jsonb(e);
  insert into public.admin_event_mutations(id, request, result) values (p_operation_id, req, r);
  return r;
end $$;

-- Applications: the one change is the canceled check (see the comment inside).
create or replace function public.submit_event_application(p_application_id uuid)
returns table (status text, missing_question_ids uuid[])
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_application public.event_applications%rowtype;
  v_event       public.events%rowtype;
  v_missing     uuid[];
begin
  -- Acquire the editor's event lock before reading questions or locking the
  -- application. Validate against the question set that this submission locks.
  perform 1 from public.events where id = (
    select event_id from public.event_applications
    where id = p_application_id and user_id = public.current_user_info_id()
  ) for update;
  select * into v_application
  from public.event_applications application
  where application.id = p_application_id
    and application.user_id = public.current_user_info_id()
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, '{}'::uuid[];
    return;
  end if;

  if v_application.status <> 'draft' then
    return query select 'NOT_DRAFT'::text, '{}'::uuid[];
    return;
  end if;

  select * into v_event
  from public.events event
  where event.id = v_application.event_id;

  -- A canceled event takes no more applications (this migration's one change).
  if not v_event.requires_application
     or v_event.canceled_at is not null
     or not (public.event_is_public(v_event.status, v_event.publish_at) or public.is_admin()) then
    return query select 'NOT_ACCEPTING_APPLICATIONS'::text, '{}'::uuid[];
    return;
  end if;

  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    return query select 'REGISTRATION_NOT_OPEN'::text, '{}'::uuid[];
    return;
  end if;

  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    return query select 'REGISTRATION_CLOSED'::text, '{}'::uuid[];
    return;
  end if;

  select coalesce(array_agg(question.id order by question.sort_order, question.created_at, question.id), '{}')
  into v_missing
  from public.event_application_questions question
  left join public.event_application_responses response
    on response.event_application_question_id = question.id
   and response.application_id = v_application.id
  cross join lateral (
    select nullif(btrim(coalesce(response.response, '')), '') as answer
  ) answer
  where question.event_id = v_event.id
    and (
      -- Missing: nothing, whitespace, or an empty checkbox selection.
      (
        question.is_required
        and (
          answer.answer is null
          or (question.response_type = 'checkbox' and answer.answer ~ '^\[\s*\]$')
        )
      )
      -- Too long.
      or (
        answer.answer is not null
        and question.max_char_limit is not null
        and question.response_type in ('short_text', 'long_text')
        and char_length(response.response) > question.max_char_limit
      )
      -- A file answer must be an object this applicant uploaded for it.
      or (
        answer.answer is not null
        and question.response_type = 'file_upload'
        and not exists (
          select 1
          from storage.objects object
          where object.bucket_id = 'application-files'
            and object.name = response.response
            and starts_with(
              object.name,
              v_application.user_id::text || '/' || v_application.id::text || '/'
                || question.id::text || '/'
            )
        )
      )
    );

  if cardinality(v_missing) > 0 then
    return query select 'INCOMPLETE'::text, v_missing;
    return;
  end if;

  perform set_config('uxhub.submitting_application', 'on', true);
  update public.event_applications application
  set status = 'submitted', submitted_at = now()
  where application.id = v_application.id;
  perform set_config('uxhub.submitting_application', 'off', true);

  return query select 'SUBMITTED'::text, '{}'::uuid[];
end;
$$;

-- Teams: a canceled event's teams are locked, as after the team deadline. All
-- four team RPCs (and rename_team) ask this function.
create or replace function public.team_change_blocked(p_event_id uuid, p_user_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    return 'EVENT_NOT_FOUND';
  end if;
  if not v_event.teams_enabled then
    return 'TEAMS_DISABLED';
  end if;
  if not exists (
    select 1 from public.event_tickets
    where event_id = p_event_id and user_id = p_user_id
  ) then
    return 'NO_TICKET';
  end if;
  if v_event.canceled_at is not null then
    return 'TEAMS_LOCKED';
  end if;
  if v_event.team_deadline is not null and now() >= v_event.team_deadline then
    return 'TEAMS_LOCKED';
  end if;
  return null;
end;
$$;

-- Check-in: no scan or manual check-in on a canceled event, whatever the
-- caller (the scanner, the lookup and the attendee table all insert here).
create function public.guard_canceled_event_check_in()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.event_tickets t
    join public.events e on e.id = t.event_id
    where t.id = new.ticket_id and e.canceled_at is not null
  ) then
    raise exception 'This event is canceled.' using hint = 'EVENT_CANCELED';
  end if;
  return new;
end $$;

create trigger guard_canceled_event_check_in before insert or update on public.check_ins
for each row execute function public.guard_canceled_event_check_in();

-- 4. Counts for the admin dialogs ---------------------------------------------

-- Read-only, for the revert and cancel dialogs:
--   registered: what blocks unpublishing (event_member_commitments);
--   member_applications: members' draft, submitted and waitlisted
--     applications, which lose access while the event is a draft;
--   paid_tickets: tickets bought with money not yet fully refunded, which
--     staff refund in Square after a cancel.
create function public.event_lifecycle_counts(p_event_id uuid)
returns table (registered integer, member_applications integer, paid_tickets integer)
language sql security definer set search_path = '' as $$
  select
    (select c.tickets + c.offers + c.pending_purchases from public.event_member_commitments(p_event_id) c),
    (select count(*)::integer from public.event_applications a
      join public.user_info u on u.id = a.user_id
      where a.event_id = p_event_id
        and a.status in ('draft', 'submitted', 'waitlisted')
        and u.deleted_at is null
        and not coalesce(u.role_access in ('admin'::public.role_access_enum, 'manager'::public.role_access_enum), false)),
    (select count(*)::integer from public.event_tickets t
      join public.purchases p on p.id = t.purchase_id
      where t.event_id = p_event_id
        and p.status = 'completed' and p.amount_cents > 0 and p.refunded_cents < p.amount_cents);
$$;

-- 5. Grants -------------------------------------------------------------------

revoke all on function public.guard_event_unpublish() from public, anon, authenticated;
revoke all on function public.guard_canceled_event() from public, anon, authenticated;
revoke all on function public.guard_canceled_event_check_in() from public, anon, authenticated;
revoke all on function public.cancel_admin_event(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.event_lifecycle_counts(uuid) from public, anon, authenticated;
grant execute on function public.cancel_admin_event(uuid, text, uuid) to service_role;
grant execute on function public.event_lifecycle_counts(uuid) to service_role;
