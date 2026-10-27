-- Scheduling changes the stored status; public visibility depends only on active.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.event_is_public(p_status public.event_status, p_publish_at timestamptz)
returns boolean
language sql stable set search_path = '' as $$
  select p_status = 'active'::public.event_status;
$$;

-- Active events are public immediately, including any scheduled under the old
-- visibility-based behavior. Only drafts retain pending publishing schedules.
update public.events set publish_at = null where status <> 'draft' and publish_at is not null;

create function public.guard_event_publish_schedule()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'draft' and new.publish_at is not null then
    if tg_op = 'INSERT' then
      raise exception 'Only draft events can have a publish date.';
    elsif new.publish_at is distinct from old.publish_at then
      raise exception 'Only draft events can have a publish date.';
    end if;
    -- Manually publishing or archiving cancels the pending schedule.
    new.publish_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_event_publish_schedule() from public, anon, authenticated;

create trigger guard_event_publish_schedule
before insert or update on public.events
for each row execute function public.guard_event_publish_schedule();

alter table public.events add constraint events_publish_schedule_requires_draft
  check (publish_at is null or status = 'draft');

create index events_pending_publication_idx on public.events (publish_at)
  where status = 'draft' and publish_at is not null;

create function public.publish_due_events()
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  published_count integer;
begin
  update public.events
    set status = 'active', publish_at = null
    where status = 'draft' and publish_at <= now();
  get diagnostics published_count = row_count;
  return published_count;
end;
$$;
revoke all on function public.publish_due_events() from public, anon, authenticated;
grant execute on function public.publish_due_events() to service_role;

-- Runs in the database even when nobody has the application open.
select cron.schedule('publish-due-events', '10 seconds', 'select public.publish_due_events()');
