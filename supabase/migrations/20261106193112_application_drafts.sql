-- Application drafts: a member saves answers as they go and submits once.
--
--   - Members insert only drafts, inside the registration window, on events
--     that take applications. Submitting goes through
--     submit_event_application, which checks the answers first.
--   - Answers can be written only while their application is a draft, and only
--     to questions of that application's event.
--   - A member may delete their own draft. Its responses cascade; its uploaded
--     files are removed by the app first (see 20261106193115).
--   - Drafts are the member's alone: admins do not see them or their answers,
--     and no decision can move one.
--   - submitted_at records when an application was submitted, which the admin
--     review list sorts by. created_at is when the draft was started.
--
-- Backward compatible with the code in production: it never inserts an
-- application as a member (insertEventApplication has no callers), and no
-- drafts exist until the new code writes them.

set search_path = '';

-- ── submitted_at ────────────────────────────────────────────────────────────

alter table public.event_applications add column submitted_at timestamptz;

update public.event_applications
set submitted_at = created_at
where submitted_at is null;

-- A row inserted directly as submitted (service role, seed, tests) gets the
-- time it was written; drafts get theirs from submit_event_application.
create function public.set_event_application_submitted_at()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'draft' then
    new.submitted_at := null;
  elsif new.submitted_at is null then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.set_event_application_submitted_at() from public, anon, authenticated;

create trigger set_event_application_submitted_at
before insert or update of status on public.event_applications
for each row execute function public.set_event_application_submitted_at();

-- ── Allowed moves ───────────────────────────────────────────────────────────
--
-- From 20261029000000, plus drafts: a draft becomes submitted only through
-- submit_event_application, which sets uxhub.submitting_application for its
-- own transaction, and nothing goes back to being a draft.

create or replace function public.check_event_application_transition()
returns trigger
language plpgsql set search_path = '' as $$
declare
  v_allowed boolean;
begin
  if new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'An application cannot move to another event or person.'
      using errcode = 'check_violation';
  end if;

  v_allowed := case old.status
    when 'draft' then
      new.status = 'draft'
      or (
        new.status = 'submitted'
        and current_setting('uxhub.submitting_application', true) = 'on'
      )
    when 'submitted' then new.status <> 'draft'
    when 'waitlisted' then new.status in ('waitlisted', 'accepted', 'rejected')
    when 'accepted' then new.status in ('accepted', 'rejected')
    when 'rejected' then new.status = 'rejected'
    else false
  end;

  if not v_allowed then
    raise exception 'An application cannot go from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if old.status = 'accepted' and new.status = 'rejected' and exists (
    select 1
    from public.event_tickets ticket
    where ticket.event_id = new.event_id
      and ticket.user_id = new.user_id
  ) then
    raise exception 'This applicant already has a ticket, so the offer cannot be taken back.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ── event_applications policies ─────────────────────────────────────────────

-- From 20261029000000, with draft in place of submitted.
drop policy "applications: insert own" on public.event_applications;
create policy "applications: insert own draft"
on public.event_applications
for insert
to authenticated
with check (
  user_id = public.current_user_info_id()
  and status = 'draft'
  and offer_expires_at is null
  and exists (
    select 1
    from public.events event
    where event.id = event_applications.event_id
      and event.requires_application
      and (public.event_is_public(event.status, event.publish_at) or public.is_admin())
      and (event.registration_opens_at is null or now() >= event.registration_opens_at)
      and (event.registration_closes_at is null or now() <= event.registration_closes_at)
  )
);

-- The member names the status, which the policy above holds to draft.
grant insert (status) on table public.event_applications to authenticated;

create policy "applications: delete own draft"
on public.event_applications
for delete
to authenticated
using (user_id = public.current_user_info_id() and status = 'draft');

grant delete on table public.event_applications to authenticated;

-- Admins read and decide submitted applications only. A member who is also an
-- admin still reads their own draft through "applications: read own".
drop policy "applications: admins read all" on public.event_applications;
create policy "applications: admins read submitted"
on public.event_applications
for select
to authenticated
using (public.is_admin() and status <> 'draft');

drop policy "applications: admins update" on public.event_applications;
create policy "applications: admins update submitted"
on public.event_applications
for update
to authenticated
using (public.is_admin() and status <> 'draft')
with check (public.is_admin() and status <> 'draft');

-- ── event_application_responses policies ────────────────────────────────────

-- True when the caller owns a draft application to `p_question_id`'s event.
-- Security definer so the policies below do not depend on what the caller
-- can select from either table.
create function public.can_edit_application_response(
  p_application_id uuid,
  p_question_id uuid
)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.event_applications application
    join public.event_application_questions question
      on question.event_id = application.event_id
    where application.id = p_application_id
      and question.id = p_question_id
      and application.user_id = public.current_user_info_id()
      and application.status = 'draft'
  );
$$;

revoke all on function public.can_edit_application_response(uuid, uuid) from public, anon;
grant execute on function public.can_edit_application_response(uuid, uuid) to authenticated;

drop policy "application responses: insert own application" on public.event_application_responses;
create policy "application responses: insert own draft"
on public.event_application_responses
for insert
to authenticated
with check (
  public.can_edit_application_response(application_id, event_application_question_id)
);

drop policy "application responses: update own application" on public.event_application_responses;
create policy "application responses: update own draft"
on public.event_application_responses
for update
to authenticated
using (
  public.can_edit_application_response(application_id, event_application_question_id)
)
with check (
  public.can_edit_application_response(application_id, event_application_question_id)
);

drop policy "application responses: delete own application" on public.event_application_responses;
create policy "application responses: delete own draft"
on public.event_application_responses
for delete
to authenticated
using (
  public.can_edit_application_response(application_id, event_application_question_id)
);

drop policy "application responses: admins read all" on public.event_application_responses;
create policy "application responses: admins read submitted"
on public.event_application_responses
for select
to authenticated
using (
  public.is_admin()
  and exists (
    select 1
    from public.event_applications application
    where application.id = event_application_responses.application_id
      and application.status <> 'draft'
  )
);

-- ── submit_event_application ────────────────────────────────────────────────
--
-- Submits the caller's draft. Returns one row: `status` is SUBMITTED, or why
-- it could not be:
--
--   NOT_FOUND                   no such application, or not the caller's
--   NOT_DRAFT                   already submitted (or decided)
--   NOT_ACCEPTING_APPLICATIONS  the event takes no applications, or is hidden
--   REGISTRATION_NOT_OPEN       before registration_opens_at
--   REGISTRATION_CLOSED         after registration_closes_at
--   INCOMPLETE                  see missing_question_ids
--
-- missing_question_ids lists, in question order, the questions whose answer
-- is missing (a required question with an empty answer, '[]' for checkboxes)
-- or invalid (text over max_char_limit, or a file answer that is not an
-- uploaded object under <user_info_id>/<application_id>/<question_id>/).

create function public.submit_event_application(p_application_id uuid)
returns table (status text, missing_question_ids uuid[])
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_application public.event_applications%rowtype;
  v_event       public.events%rowtype;
  v_missing     uuid[];
begin
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

  if not v_event.requires_application
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

revoke all on function public.submit_event_application(uuid) from public, anon;
grant execute on function public.submit_event_application(uuid) to authenticated, service_role;
