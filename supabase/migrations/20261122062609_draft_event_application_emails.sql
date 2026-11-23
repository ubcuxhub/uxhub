-- Application emails for draft events (docs/event-states.md, "Application
-- emails"; supabase/README.md, "Application emails").
--
-- `application_emails.due_work` sent nothing for a draft event, so execs
-- testing the application flow on an unpublished event never got the decision
-- or the offer reminder. Only staff (admins and managers) can apply to a draft
-- or see one, but a published event that went back to Draft can still hold
-- members' waitlisted, rejected or submitted applications, and its page is a
-- 404 to them. So a draft's emails go to staff applicants only; a published
-- event's go to everyone, as before.
--
-- Everything else is unchanged: canceled and finished events, events that no
-- longer take applications, unreleased decisions, deleted applicants, ticket
-- holders, the deduplication, retries and claims. Same signature, owner and
-- privileges (create or replace keeps them), so the code in production keeps
-- working. claim_application_emails and the cron job read due_work, so they
-- follow.
--
-- No backfill: released decisions already waiting on a staff applicant's
-- draft event are due once this deploys, and send on the next run.

create or replace function application_emails.due_work(p_event_ids uuid[] default null)
returns table (application_id uuid, kind text, key text)
language sql stable security definer set search_path = '' as $$
  select application.id, work.kind, work.key
  from public.event_applications application
  join public.events event on event.id = application.event_id
  join public.user_info applicant on applicant.id = application.user_id
  cross join lateral (
    -- The decision, once released. An offer that expired before we sent it
    -- would only tell them about a spot that's gone.
    select application.status::text, application.status::text
    where application.status in ('accepted', 'waitlisted', 'rejected')
      and (application.status <> 'accepted' or application.offer_expires_at > now())
    union all
    -- A day before the deadline, unless the acceptance itself went out inside
    -- that day (it names the deadline).
    select 'offer_reminder', application_emails.deadline_key(application.offer_expires_at)
    where application.status = 'accepted'
      and application.offer_expires_at > now()
      and application.offer_expires_at <= now() + interval '24 hours'
      and exists (
        select 1 from application_emails.deliveries accepted
        where accepted.application_id = application.id
          and accepted.kind = 'accepted'
          and accepted.key = 'accepted'
          and accepted.sent_at is not null
          and accepted.sent_at <= application.offer_expires_at - interval '24 hours'
      )
  ) work (kind, key)
  where (p_event_ids is null or application.event_id = any (p_event_ids))
    and event.requires_application
    -- A draft only for staff, who are the only ones who can open its page.
    and (
      event.status = 'active'
      or (
        event.status = 'draft'
        and applicant.role_access in ('admin'::public.role_access_enum, 'manager'::public.role_access_enum)
      )
    )
    and event.canceled_at is null
    and coalesce(event.ends_at, event.starts_at, 'infinity'::timestamptz) > now()
    and applicant.deleted_at is null
    and public.application_decisions_released(application.event_id)
    and not exists (
      select 1 from public.event_tickets ticket
      where ticket.event_id = application.event_id
        and ticket.user_id = application.user_id
    )
    and not exists (
      select 1 from application_emails.deliveries delivery
      where delivery.application_id = application.id
        and delivery.kind = work.kind
        and delivery.key = work.key
        and (
          delivery.sent_at is not null
          or delivery.attempts >= 5
          or delivery.claimed_at > now() - interval '15 minutes'
        )
    );
$$;

revoke all on function application_emails.due_work(uuid[]) from public, anon, authenticated, service_role;
